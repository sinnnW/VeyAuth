import { App } from "./App";
import { User } from "./User";
import { SubscriptionLevel } from "./SubscriptionLevel";
import { ISubscription } from "./interfaces/ISubscription";
import { FLAGS } from './UserPermissions';
import { Utils } from '../utils/Utils';
import { Core } from '..';

export class Subscription implements ISubscription {
  // IBase fields
  id: number;
  disabled: boolean;
  disableReason?: string;

  // ISubscription fields
  application: App;
  user: User;
  level: SubscriptionLevel;
  expiresAt?: Date;

  // Completely private vars
  #changes = false;

  get format(): string {
    return `(SubscriptionID: ${this.id} [User: ${this.user.format}] [App: ${this.application.format}])`;
  }

  /**
   * Set the new date that the subscription expires at
   * @param newDate 
   */
  setExpiresAt(newDate: Date) {
    this.#changes = true;
    this.expiresAt = newDate;
  }

  /**
   * Save any staged changes
   * @param auth 
   * @returns {Promise<Subscription>} Updated subscription
   */
  save(auth: User): Promise<Subscription> {
    return new Promise((resolve, reject) => {
			// If this is true, there are no changes to make
			if (!this.#changes)
				return resolve(this);

			// Make sure that they have permission
			else if (!auth?.permissions.has(FLAGS.MODIFY_SUBSCRIPTION, this.id))
				return reject('Invalid permissions')

			Core.logger.debug(`Saving subscription information for ${this.format}, auth: ${auth.format}`);
      // Run all the save commands
      Core.db.serialize(() => {
        // Update disable_reason
        Core.db.run('UPDATE subscriptions SET expires_at = ? WHERE id = ?', [(this.expiresAt?.getTime() || 1000) - 1000, this.id], async () => {
          Core.logger.debug('Updated disable_reason');

          // Updates were saved
          this.#changes = false;

          // Return the updated user
          Core.logger.debug(`Saved application information for ${this.format}`);
          return resolve(this);
        });
      });
    })
  }

  /**
   * Remove the current subscription
   * @param {User} auth 
   * @returns {Promise<void>}
   */
  async remove(auth: User): Promise<void> {
    return Subscription.remove(auth, this.application, this);
  }

  /**
   * Remove an existing subscription
   * @param {User} auth 
   * @param {App} app 
   * @param {Subscription} subscription
   * @returns {Promise<void>}
   */
  static remove(auth: User, app: App, subscription: Subscription): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!auth?.permissions.has(FLAGS.DELETE_SUBSCRIPTION))
        return reject('Invalid permissions');

      // Delete the shit
      Core.db.run('DELETE FROM subscriptions WHERE application_id = ? AND id = ?', [ app.id, subscription.id ], async err => {
        if (err)
          return reject(err);

        return resolve();
      });
    })
  }

  /**
   * Create a new subscription for a user
   * @param {User} auth 
   * @param {App} app 
   * @param {User} user 
   * @param {SubscriptionLevel} subscriptionLevel 
   * @param {Date} expiresAt 
   * @param {boolean} overwrite Should we overwrite a previous subscription on the user (if it exists, and application only allows one subscription at a time)
   * @returns {Promise<Subscription>}
   */
  static create(auth: User, app: App, user: User, subscriptionLevel: SubscriptionLevel, expiresAt: Date, overwrite?: boolean): Promise<Subscription> {
    return new Promise<Subscription>(async (resolve, reject) => {
      if (!auth?.permissions.has(FLAGS.CREATE_SUBSCRIPTION))
        return reject('Invalid permissions');

      let prev = await Subscription.get(auth, app, user)
        .catch(() => {});

      if (prev && !overwrite && !app.multipleSubscriptions)
        return reject('There is already a subscription active.');

      Core.db.serialize(() => {
        if (!app.multipleSubscriptions)
          Core.db.run('DELETE FROM subscriptions WHERE application_id = ? AND user_id = ?', [ app.id, user.id ]);
        else
          Core.db.run('DELETE FROM subscriptions WHERE application_id = ? AND user_id = ? AND level_id = ?', [ app.id, user.id, subscriptionLevel.id ]);
        
        Core.db.get('SELECT * FROM subscriptions WHERE application_id = ? ORDER BY id DESC', [ app.id ], (err, data) => {
          if (err)
            return reject(err);

          let id = (data?.id || 0) + 1;

          Core.db.run('INSERT INTO subscriptions (id, application_id, user_id, level_id, expires_at) VALUES (?, ?, ?, ?, ?)', [ id, app.id, user.id, subscriptionLevel.id, expiresAt.getTime() ], async err => {
            if (err)
              return reject(err);

            return resolve(await Subscription.get(auth, app, user, id) as Subscription);
          })
        })
      })
    })
  }

  static get(auth: User | null, app: App, user: User, id?: number): Promise<[Subscription] | Subscription> {
    return new Promise<[Subscription] | Subscription>((resolve, reject) => {
      if (auth?.id != user?.id && !auth?.permissions.has(FLAGS.VIEW_SUBSCRIPTION))
        return reject('Invalid permissions');

      Core.db.all(`SELECT * FROM subscriptions WHERE application_id = ? AND user_id = ? ${id ? 'AND id = ?' : ''}`, [ app.id, user.id, id ], async (err, data) => {
        // Reject errors
        if (err)
          return reject(err);

        // If there is data, the subscriptions are NOT public, and the requesting user is not the same as the target user, reject.
        else if (!auth?.application.publicSubscriptions && user.id != auth?.id && !auth?.permissions.has(FLAGS.VIEW_SUBSCRIPTION))
          return reject('Subscriptions are not public on this application')

        // No data.
        else if (!data?.length)
          return reject('User does not have a subscription');

        // Return the data
        else
          return resolve(await Subscription.fill(auth, !app.multipleSubscriptions ? data[0] : data, user));
      })
    })
  }

  static fill(auth: User, data: any, parent?: User): Promise<[Subscription] | Subscription> {
    return new Promise<[Subscription] | Subscription>(async (resolve, reject) => {
      if (data.length) {
        let subArr = [];
  
        for (var x = 0;x < data.length;x++) {
          var sub = new Subscription();
      
          sub.id = data[x].id;
          sub.disabled = data[x].disabled == 1 ? true : false;
          sub.disableReason = data[x].disable_reason;
          sub.application = await App.get(data[x].application_id);
          sub.user = parent || await User.get(data[x].user_id);
          sub.level = await SubscriptionLevel.get(auth, sub.application, data[x].level_id);
          sub.expiresAt = await new Date(data[x].expires_at * 1000);

          subArr.push(sub);
        }
  
        return resolve(subArr as [Subscription]);
      } else {
        var sub = new Subscription();

        sub.id = data.id;
        sub.disabled = data.disabled == 1 ? true : false;
        sub.disableReason = data.disable_reason;
        sub.application = await App.get(data.application_id);
        sub.user = parent || await User.get(data.user_id);
        sub.level = await SubscriptionLevel.get(auth, sub.application, data.level_id);
        sub.expiresAt = await new Date(data.expires_at * 1000);

        return resolve(sub);
      }
    })
  }
}