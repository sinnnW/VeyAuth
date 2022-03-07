import { App } from './App';
import { User } from './User';
import { ISubscriptionLevel } from './interfaces/ISubscriptionLevel';
import { Core } from '../index';
import { FLAGS } from './UserPermissions';
import { Utils } from '../utils/Utils';

export class SubscriptionLevel implements ISubscriptionLevel {
  // IBase attributes
  id: number;
  disabled: boolean;
  disableReason?: string

  // ISubscriptionLevel attributes
  application: App;
  name: string;
  description?: string;

  // Completely hidden fields
  #changes = false;
  #prevName: string;

  get format(): string {
    return `(${this.name} [SubscriptionLevelID ${this.id}])`;
  }

  setName(name: string) {
    if (Utils.hasSpecialChars(name))
      throw new Error('Name cannot contain special characters');

    this.#changes = true;
    this.#prevName = this.name;
    this.name = name;
  }

  setDescription(desc: string) {
    this.#changes = true;
    this.description = desc;
  }

  setDisabled(disabled: boolean) {
    this.#changes = true;
    this.disabled = disabled;
  }

  enable() {
    this.setDisabled(false);
  }

  disable() {
    this.setDisabled(true);
  }

  setDisableReason(reason: string) {
    this.#changes = true;
    this.disableReason = reason;
  }

  /**
   * Save the changed items
   * @param {User} auth
   */
  save(auth: User): Promise<SubscriptionLevel> {
    return new Promise<SubscriptionLevel>((resolve, reject) => {
      if (!this.#prevName)
        this.#prevName = this.name;

			// If this is true, there are no changes to make
			else if (!this.#changes)
				return resolve(this);

			// Make sure that they have permission
			else if (!auth?.permissions.has(FLAGS.MODIFY_USERS, this.id))
				return reject('Invalid permissions')

			// Make sure all the required fields are filled
			else if (!this.name || (!this.disabled && this.disabled !== false))
				return reject('Name, disabled are required.');

			// Make sure the username doesn't contain special chars
			else if (Utils.hasSpecialChars(this.name))
				return reject('Name cannot contain special characters')

			Core.logger.debug(`Saving subscription level information for ${this.format}, auth: ${auth.format}`);
			Core.db.get('SELECT * FROM subscription_levels WHERE name = ?', [this.name], (err, row) => {
				if (err)
					return reject(err);
				else if (row && this.name != this.#prevName)
					return reject('Name is already taken');

				// Run all the save commands
				Core.db.serialize(() => {
					// Set the name
					Core.db.run('UPDATE applications SET name = ? WHERE id = ?', [this.name, this.id]);
					Core.logger.debug('Updated name');

					// Set the description
					Core.db.run('UPDATE applications SET description = ? WHERE id = ?', [this.description == 'No description' ? null : this.description, this.id]);
					Core.logger.debug('Updated description');

					// Update disabled
					Core.db.run('UPDATE applications SET disabled = ? WHERE id = ?', [this.disabled ? 1 : 0, this.id]);
					Core.logger.debug('Updated disabled');

					// Update disable_reason
					Core.db.run('UPDATE applications SET disable_reason = ? WHERE id = ?', [this.disableReason == 'No reason' ? null : this.disableReason, this.id], async () => {
						Core.logger.debug('Updated disable_reason');

						// Updates were saved
						this.#changes = false;

						// Return the updated user
						Core.logger.debug(`Saved subscription level information for ${this.format}`);
						return resolve(this);
					});
				});
			});
    })
  }

  /**
   * Create a new subscription level
   * @param {User} auth
   * @param {App} app
   * @param {string} name Subscription level name 
   * @param {string} description Subscription level description 
   * @returns {Promise<SubscriptionLevel>} The created subscription level
   */
  static create(auth: User, app: App, name: string, description?: string): Promise<SubscriptionLevel> {
    return new Promise<SubscriptionLevel>((resolve, reject) => {
      // Make sure they have permission
      if (!auth?.permissions.has(FLAGS.CREATE_SUBSCRIPTION_LEVEL))
        return reject('Invalid permissions');

      Core.db.get('SELECT id FROM subscription_levels WHERE application_id = ? ORDER BY id DESC', [ app.id ], (err, data) => {
        if (err)
          return reject(err);

        // Get an ID for a new subscription level
        let id = (data?.id || 0) + 1;

        Core.db.run('INSERT INTO subscription_levels (id, application_id, name, description) VALUES (?, ?, ?, ?)', [ id, app.id, name, description ], async err => {
          if (err)
            return reject(err);

          // Resolve with the created subscription level
          return resolve(await SubscriptionLevel.get(auth, app, id));
        })
      })
    })
  }

  /**
   * Get a subscription level from ID
   * @param {User} auth
   * @param {App} app
   * @param {number} id Subscription level ID
   * @returns {Promise<SubscriptionLevel>} Subscription level found
   */
  static get(auth: User | null, app: App, id: number): Promise<SubscriptionLevel> {
    return new Promise<SubscriptionLevel>((resolve, reject) => {
      Core.db.get('SELECT * FROM subscription_levels WHERE application_id = ? AND id = ?', [ app.id, id ], async (err, data) => {
        if (err)
          return reject(err);

        let app = await App.get(data.application_id);

        // Make sure that its not private data, and if it is, that there is valid auth to check it
        if (!app.publicSubscriptions && !auth?.permissions.has(FLAGS.VIEW_SUBSCRIPTION))
          return reject('Subscriptions are private on this application');

        // Check if there is no data
        else if (!data)
          return reject('Unknown subscription level ID');

        // Return the actual stuff
        return resolve(await SubscriptionLevel.fill(data));
      });
    })
  }

  /**
   * This will find a subscription level with a certain name
   * @param {User} auth 
   * @param {App} app 
   * @param {string} name 
   * @param {boolean} checkSimilar Should it check for similar names?
   * @returns {Promise<SubscriptionLevel>} THe found subscription level
   */
  static find(auth: User | null, app: App, name: string, checkSimilar = false): Promise<SubscriptionLevel> {
    return new Promise<SubscriptionLevel>((resolve, reject) => {
      Core.db.get('SELECT * FROM subscription_levels WHERE application_id = ? AND name = ?', [ app.id, name ], async (err, data) => {
        if (err)
          return reject(err);

        // Get the app, we need this to check if subscriptions are public
        let app = await App.get(data.application_id);

        // Make sure they have permission to see
        if (!app.publicSubscriptions && !auth?.permissions.has(FLAGS.VIEW_SUBSCRIPTION))
          return reject('Subscriptions are private on this application');

        // This will check by pattern, to see if any names contain the text
        else if (!data && checkSimilar) {
          Core.db.get('SELECT * FROM subscription_levels WHERE application_id = ? AND name LIKE \'%?%\'', [ app.id, name ], async (err, data) => {
            if (err)
              return reject(err);

            // If there is no data, return
            else if (!data)
              return reject('Unknown subscription level name');

            // If there is, finish
            else
              return resolve(await SubscriptionLevel.fill(data));
          })
        }
        
        // We can just return now.
        else
          return resolve(await SubscriptionLevel.fill(data));        
      })
    })
  }

  static fill(data: any): Promise<SubscriptionLevel> {
    return new Promise<SubscriptionLevel>(async (resolve, reject) => {
      var sl = new SubscriptionLevel();

      sl.id = data.id;
      sl.disabled = data.disabled == 1 ? true : false;
      sl.disableReason = data.disable_reason;
      sl.application = await App.get(data.application_id);
      sl.name = data.name;
      sl.description = data.description;

      return resolve(sl);
    })
  }
}