import { IApp } from './interfaces/IApp';
import { IVar } from './interfaces/IVar';
import { User } from './User';
import { Auth } from '..';
import { Utils } from '../utils/Utils';
import { FLAGS } from './UserPermissions';

enum GET_FLAGS {
	GET_BY_ID,
	GET_BY_NAME
}

export class App implements IApp {
	// FLAGS
	static GET_FLAGS = GET_FLAGS;

    // IBase fields
	id: number;
	disabled: boolean;
	disableReason?: string;

    // IApp fields
	name: string;
	description: string;
	owner : User;
	allowUserSelfDeletion: boolean;

	// Internal var to detect if there is changes for saving
	#changes = false;

	// Internal var for previous name, since it has to check on save()
	#prevName: string;
    
	/**
	 * @returns {string} Formatted app name and ID
	 */
	get format(): string {
		return `(${this.name} [AppID ${this.id}])`;
	}

    /**
	 * Enable or disable an application
	 * @param disabled true = disabled, false = enabled
	 */
    setDisabled(disabled: boolean) {
		this.#changes = true;
        this.disabled = disabled;
    }

	/**
	 * Enable the app
	 */
	enable() {
		this.setDisabled(false);
	}

	/**
	 * Disable the app
	 */
	disable() {
		this.setDisabled(true);
	}

    /**
	 * Set the reason why an application is disabled
	 * @param disableReason Reason
	 */
    setDisableReason(disableReason: string) {
		this.#changes = true;
        this.disableReason = disableReason;
    }

	/**
	 * Set app name
	 * @param name 
	 */
	setName(name: string) {
		if (Utils.hasSpecialChars(name))
			throw new Error('Name cannot contain special characters');

		this.#changes = true;
		this.#prevName = this.name;
        this.name = name;
	}    
    
	/**
	 * Set the description for the app
	 * @param description 
	 */
    setDescription(description: string) {
		this.#changes = true;
        this.description = description;
	}

	/**
	 * Update the applications owner
	 * @param newOwner The new owner
	 */
	setOwner(newOwner: User) {
		this.#changes = true;
		this.owner = newOwner;
	}

	/**
	 * Save changes to the app
	 * @params auth
	 * @returns {Promise<App>} App changes
	 */
	save(auth: User): Promise<App> {
		return new Promise<App>((resolve, reject) => {
			if (!this.#prevName)
				this.#prevName = this.name;

			// If this is true, there are no changes to make
            if (!this.#changes)
                return resolve(this);

            // Make sure that they have permission
            else if (!auth?.permissions.has(FLAGS.MODIFY_USERS, this.id))
                return reject('Invalid permissions')

            // Make sure all the required fields are filled
            else if (!this.name || !this.owner || (!this.disabled && this.disabled !== false))
                return reject('Name, owner, and disabled are required.');

            // Make sure the username doesn't contain special chars
            else if (Utils.hasSpecialChars(this.name))
                return reject('Name cannot contain special characters')

            Auth.logger.debug(`Saving application information for ${this.format}, auth: ${auth.format}`);
            Auth.db.get('SELECT * FROM applications WHERE name = ?', [ this.name ], (err, row) => {
                if (err)
                    return reject(err);
                else if (row && this.name != this.#prevName)
                    return reject('Name is already taken');

                // Run all the save commands
                Auth.db.serialize(() => {
                    // Set the name
                    Auth.db.run('UPDATE applications SET name = ? WHERE id = ?', [ this.name, this.id ]);
                    Auth.logger.debug('Updated name');

                    // Set the description
                    Auth.db.run('UPDATE applications SET description = ? WHERE id = ?', [ this.description == 'No description' ? null : this.description, this.id ]);
                    Auth.logger.debug('Updated description');

                    // Update owner
                    Auth.db.run('UPDATE applications SET owner_id = ? WHERE id = ?', [ this.owner.id, this.id ]);
                    Auth.logger.debug('Updated owner');

                    // Update disabled
                    Auth.db.run('UPDATE applications SET disabled = ? WHERE id = ?', [ this.disabled ? 1 : 0, this.id ]);
                    Auth.logger.debug('Updated disabled');

                    // Update disable_reason
                    Auth.db.run('UPDATE applications SET disable_reason = ? WHERE id = ?', [ this.disableReason == 'No reason' ? null : this.disableReason, this.id ], async () => {
						Auth.logger.debug('Updated disable_reason');

						// Updates were saved
						this.#changes = false;

						// Return the updated user
						Auth.logger.debug(`Saved user information for ${this.format}`);
						return resolve(this);
					});
                });
            });
		})
	}

	/**
	 * Get the amount of users in the database for the app
	 */
	getUserCount(): Promise<number> {
		return new Promise<number>((resolve, reject) => {
			Auth.db.all('SELECT * FROM users WHERE application_id = ?', (err, rows) => {
				if (err)
					return reject(err);
				else
					return resolve(rows.length || 0);
			})
		})
	}
	
	getVars(authToken: string, hwid: string): [IVar]
	{
		throw new Error("Not implemented");
	}

	delete(auth: User): Promise<void> {
		return new Promise((resolve, reject) => {
			// Make sure user has permission
			if (!auth?.permissions.has(FLAGS.MODIFY_USERS, this.id))
				return reject('Invalid permissions');
			
			Auth.db.serialize(() => {
				Auth.db.run('DELETE FROM applications WHERE id = ?', [ this.id ]);
				Auth.db.run('DELETE FROM users WHERE application_id = ?', [ this.id ]);
				Auth.db.run('DELETE FROM permissions WHERE application_id = ?', [ this.id ], () => {
					Auth.logger.debug(`Deleted application ${this.format}`);
					resolve();
				});
			})
		})
	}

	/**
	 * Create an application
	 * @param auth Auth user with permissions to create an application
	 * @param name Name of app
	 * @param description App description
	 * @param subscriptionsEnabled 
	 * @param inviteRequired 
	 * @param hwidLocked 
	 * @returns {Promise<App>} App created
	 */
    static create(auth: User, name: string, description?: string, subscriptionsEnabled: boolean = false, inviteRequired: boolean = false, hwidLocked: boolean = false): Promise<App> {
		return new Promise<App>(async (resolve, reject) => {
			Auth.logger.debug(`Creating app ${name} with owner ${auth.format}`);
			if (!auth?.permissions.has(FLAGS.CREATE_APPLICATION))
				return reject('Invalid permissions');

			else if (auth.application.id != -1)
				return reject('This user must be assigned to app ID -1 to create apps');

			else if (Utils.hasSpecialChars(name))
				return reject('Name cannot contain special characters');

			var id = 1;
			Auth.db.serialize(() => {
				// Make sure name isnt taken
				Auth.db.get('SELECT name FROM applications WHERE name = ?', [ name ], (err, data) => {
					if (err)
						return reject(err);
					else if (data)
						return reject('App name is already taken');

					// Get the id
					Auth.db.get('SELECT id FROM applications ORDER BY id DESC', (err, data) => {
						if (err)
							return reject(err);
						else
							id += data.id || 0;
	
						// Create the actual application
						Auth.db.run('INSERT INTO applications (id, owner_id, name, description, subscriptions_enabled, invite_required, hwid_locked) VALUES (?, ?, ?, ?, ?, ?, ?)', [ id, auth.id, name, description, subscriptionsEnabled, inviteRequired, hwidLocked ], async err => {
							if (err)
								return reject(err);
							else {
								var app = await App.get(id);
								Auth.logger.debug(`Created app ${app.format} with owner ${app.owner.format}`);
								return resolve(app);
							}
						})
					})
				});
			});
		})
    }
	
	// This is the function to fetch an application from the database
	// If the input is a string, try and fetch by name, if its a number,
	// try and fetch by name, else, reject.
	// - verlox @ 1/28/22
	static get(identifier: any, method?: GET_FLAGS, omitOwner: boolean = false): Promise<App> {
		return new Promise((resolve, reject) => {
			switch (method) {
				case GET_FLAGS.GET_BY_NAME:
					App.getByName(identifier, omitOwner).then(resolve).catch(reject);
					break;
				case GET_FLAGS.GET_BY_ID:
				default: // We stack this so that if they don't supply the method, we just default to this
					App.getById(+identifier, omitOwner).then(resolve).catch(reject);
					break;
			}
		})
	}

	private static fill(data: any, omitOwner: boolean) { 
		return new Promise<App>(async (resolve, reject) => {
			var app = new App();
    
            // Set the properties from the db
			if (!omitOwner) {
				try {
					app.owner = await User.get(data.owner_id);
				} catch {}
			}

			app.id = data.id;
			app.name = data.name;
			app.description = data.description || 'No description';
			app.disabled = data.disabled == 1 ? true : false;
			app.disableReason = data.disable_reason || 'No reason';
			app.allowUserSelfDeletion = data.allow_user_self_deletion == 1 ? true : false;

			return resolve(app);
		})
	}

    private static getById(id: number, omitOwner: boolean): Promise<App> {
		return new Promise<App>((resolve, reject) => {
			// check if application already exists in _db
			Auth.db.get('SELECT * FROM applications WHERE id = ?', [ id ], (err, data) => {
				if (err)
					throw err;
				// if it doesn't exist, throw an error
				else if (!data)
					throw new Error('Unknown application');
				else
					this.fill(data, omitOwner).then(resolve); // No catch, because nothing can reject, its just formatting
			})
		})
	}

	private static getByName(name: string, omitOwner: boolean): Promise<App> {
		return new Promise<App>((resolve, reject) => {
			Auth.db.get('SELECT * FROM applications WHERE name = ?', [ name ], (err, data) => {
				if (err)
					return reject(err)
				else if (!data)
					throw new Error('Unknown application');
				else
					this.fill(data, omitOwner).then(resolve); // No catch, because nothing can reject, its just formatting
			})
		})
	}

}