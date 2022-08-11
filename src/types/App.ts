import { User } from './User';
import { Core } from '..';
import { Utils } from '../utils/Utils';
import { FLAGS } from './UserPermissions';
import { textChangeRangeIsUnchanged } from 'typescript';

enum GET_FLAGS {
	GET_BY_ID,
	GET_BY_NAME
}

export class App {
	// FLAGS
	static GET_FLAGS = GET_FLAGS;

	// IBase fields
	id: number;
	disabled: boolean;
	disableReason?: string;

	// IApp fields
	name: string;
	description: string;
	owner: User;
	allowUserSelfDeletion: boolean;
	subscriptionsEnabled: boolean;
	publicSubscriptions: boolean;
	multipleSubscriptions: boolean;
	usersCanCreateFiles: boolean;
	inviteOnly: boolean;
	hwidLocked: boolean;

	// Internal var to detect if there is changes for saving
	#changes = false;
	#deleted = false;

	// Internal var for previous name, since it has to check on save()
	#prevName: string | null;

	/**
   * Formatted application information
   * @returns {string} Formatted information
   */
	get format(): string {
		return `(${this.name} [AppID ${this.id}] [OwnerID ${this.owner.id}])`;
	}

	/**
	* Enable or disable an application
	* @param {boolean} disabled true = disabled, false = enabled
	*/
	setDisabled(disabled: boolean) {
		if (typeof disabled != 'boolean')
			return;

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
	* @param {string} disableReason Reason
	*/
	setDisableReason(disableReason: string) {
		this.#changes = true;
		this.disableReason = disableReason;
	}

	/**
	* Set app name
	* @param {string} name New name 
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
	* @param {string} description New application description 
	*/
	setDescription(description: string) {
		this.#changes = true;
		this.description = description;
	}

	/**
	* Update the applications owner
	* @param {User} newOwner The new owner
	*/
	setOwner(newOwner: User) {
		this.#changes = true;
		this.owner = newOwner;
	}

	/**
	 * Set the application to invite only or not
	 * @param {boolean} inviteOnly 
	 */
	setInviteOnly(inviteOnly: boolean) {
		if (typeof inviteOnly != 'boolean')
			return;

		this.#changes = true;
		this.inviteOnly = inviteOnly;
	}

	/**
	 * Set subscription enabled/disabled
	 * @param {boolean} enabled 
	 */
	setSubscriptionsEnabled(enabled: boolean) {
		if (typeof enabled != 'boolean')
			return;

		this.#changes = true;
		this.subscriptionsEnabled = enabled;
	}

	/**
	 * Can users hold multiple subscriptions at the same time
	 * @param {boolean} allowed 
	 */
	setMultipleSubscriptionsAllowed(allowed: boolean) {
		if (typeof allowed != 'boolean')
			return;

		this.#changes = true;
		this.multipleSubscriptions = allowed;
	}

	/**
	 * Can anyone view anyone's subscriptions
	 * @param {boolean} subsPublic 
	 */
	setSubscriptionsPublic(subsPublic: boolean) {
		if (typeof subsPublic != 'boolean')
			return;

		this.#changes = true;
		this.publicSubscriptions = subsPublic;
	}

	/**
	 * Should users be locked based on HWID additionally
	 * @param {boolean} locked 
	 */
	setHwidLocked(locked: boolean) {
		if (typeof locked != 'boolean')
			return;

		this.#changes = true;
		this.hwidLocked = locked;
	}

	/**
	 * Can users delete their own accounts
	 * @param {boolean} allowSelfDelete 
	 */
	setAllowUserSelfDeletion(allowSelfDelete: boolean) {
		if (typeof allowSelfDelete != 'boolean')
			return;

		this.#changes = true;
		this.allowUserSelfDeletion = allowSelfDelete;
	}

	/**
	 * Can users create their own files
	 * @param {boolean} allowFiles
	 */
	setUsersCanCreateFiles(allowFiles: boolean) {
		if (typeof allowFiles != 'boolean')
			return;

		this.#changes = true;
		this.usersCanCreateFiles = allowFiles;
	}

	/**
	* Save changes to the app
	* @param {User} auth Authorization 
	* @returns {Promise<App>} App changes
	*/
	save(auth: User): Promise<App> {
		return new Promise<App>((resolve, reject) => {
			if (this.#deleted)
				return reject('Application does not exist');

			else if (this.id == -1)
				return reject('This application cannot be modified');

			else if (!this.#prevName)
				this.#prevName = this.name;

			// If this is true, there are no changes to make
			if (!this.#changes)
				return resolve(this);

			// Make sure that they have permission
			else if (!auth?.permissions.has(FLAGS.ADMIN, this.id) && this.owner.id != auth.id)
				return reject('Invalid permissions')

			// Make sure all the required fields are filled
			else if (!this.name || !this.owner || (!this.disabled && this.disabled != false))
				return reject('Name, owner, and disabled are required');

			// Make sure the username doesn't contain special chars
			else if (Utils.hasSpecialChars(this.name))
				return reject('Name cannot contain special characters')

			Core.logger.debug(`Saving application information for ${this.format}, auth: ${auth.format}`);
			Core.db.get('SELECT * FROM applications WHERE name = ?', [this.name], (err, row) => {
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

					// Update owner
					Core.db.run('UPDATE applications SET owner_id = ? WHERE id = ?', [this.owner.id, this.id]);
					Core.logger.debug('Updated owner');

					// Update disabled
					Core.db.run('UPDATE applications SET disabled = ? WHERE id = ?', [this.disabled ? 1 : 0, this.id]);
					Core.logger.debug('Updated disabled');

					// Update invite_only
					Core.db.run('UPDATE applications SET invite_only = ? WHERE id = ?', [this.inviteOnly, this.id]);
					Core.logger.debug('Updated invite_only');

					Core.db.run('UPDATE applications SET hwid_locked = ? WHERE id = ?', [this.hwidLocked ? 1 : 0, this.id]);
					Core.logger.debug('Updated hwid_locked');

					Core.db.run('UPDATE applications SET subscriptions_enabled = ? WHERE id = ?', [this.subscriptionsEnabled ? 1 : 0, this.id]);
					Core.logger.debug('Updated subscriptions_enabled');

					Core.db.run('UPDATE applications SET subscriptions_multiple = ? WHERE id = ?', [this.multipleSubscriptions ? 1 : 0, this.id]);
					Core.logger.debug('Updated subscriptions_multiple');

					Core.db.run('UPDATE applications SET subscriptions_public = ? WHERE id = ?', [this.publicSubscriptions ? 1 : 0, this.id]);
					Core.logger.debug('Updated subscriptions_public');

					Core.db.run('UPDATE applications SET allow_user_self_deletion = ? WHERE id = ?', [this.allowUserSelfDeletion ? 1 : 0, this.id]);
					Core.logger.debug('Updated allow_user_self_deletion');

					Core.db.run('UPDATE applications SET users_can_create_files = ? WHERE id = ?', [this.usersCanCreateFiles ? 1 : 0, this.id]);
					Core.logger.debug('Updated users_can_create_files');


					// Update disable_reason
					Core.db.run('UPDATE applications SET disable_reason = ? WHERE id = ?', [this.disableReason == 'No reason' ? null : this.disableReason, this.id], async () => {
						Core.logger.debug('Updated disable_reason');

						// Updates were saved
						this.#changes = false;
						this.#prevName = null;

						// Return the updated user
						Core.logger.debug(`Saved application information for ${this.format}`);
						return resolve(this);
					});
				});
			});
		})
	}

	/**
	 * Delete the current application
	 * @param {User} auth Authorization
	 * @returns {Promise<void>}
	 */
	delete(auth: User): Promise<void> {
		this.#deleted = true;
		return App.delete(auth, this);
	}

	/**
	* Get the amount of users in the database for the app
	*/
	getUserCount(): Promise<number> {
		return new Promise<number>((resolve, reject) => {
			Core.db.all('SELECT * FROM users WHERE application_id = ?', (err, rows) => {
				if (err)
					return reject(err);
				else
					return resolve(rows.length || 0);
			})
		})
	}

	/**
	 * Delete an application
	 * @param {User} auth Authorization
	 * @param {App} app Application
	 * @returns {Promise<void>}
	 */
	static delete(auth: User, app: App): Promise<void> {
		return new Promise((resolve, reject) => {
			// Make sure user has permission
			if (!auth?.permissions.has(FLAGS.MODIFY_USERS, app.id))
				return reject('Invalid permissions');

			Core.db.serialize(() => {
				Core.db.run('DELETE FROM applications WHERE id = ?', [app.id]);
				Core.db.run('DELETE FROM users WHERE application_id = ?', [app.id]);
				Core.db.run('DELETE FROM variables WHERE application_id = ?', [app.id]);
				Core.db.run('DELETE FROM subscriptions WHERE application_id = ?', [app.id]);
				Core.db.run('DELETE FROM subscription_levels WHERE application_id = ?', [app.id]);
				Core.db.run('DELETE FROM permissions WHERE application_id = ?', [app.id], () => {
					Core.logger.debug(`Deleted application ${app.format}`);
					resolve();
				});
			})
		})
	}

	/**
	* Create an application
	* @param {User} auth Authorization Core user with permissions to create an application
	* @param {string} name Name of app
	* @param {string} description App description
	* @param {boolean} subscriptionsEnabled Are subscriptions enabled
	* @param {boolean} inviteOnly Do new users need an invite
	* @param {boolean} hwidLocked Are user logins HWID locked
	* @returns {Promise<App>} App created
	*/
	static create(auth: User, name: string, description?: string, subscriptionsEnabled: boolean = false, inviteOnly: boolean = false, hwidLocked: boolean = false): Promise<App> {
		return new Promise<App>(async (resolve, reject) => {
			Core.logger.debug(`Creating app ${name} with owner ${auth.format}`);
			if (!auth?.permissions.has(FLAGS.CREATE_APPLICATION))
				return reject('Invalid permissions');

			else if (auth.application.id != -1)
				return reject('This user must be assigned to app ID -1 to create apps');

			else if (Utils.hasSpecialChars(name))
				return reject('Name cannot contain special characters');

			var id = 1;
			Core.db.serialize(() => {
				// Make sure name isnt taken
				Core.db.get('SELECT name FROM applications WHERE name = ?', [name], (err, data) => {
					if (err)
						return reject(err);
					else if (data)
						return reject('App name is already taken');

					// Get the id
					Core.db.get('SELECT id FROM applications ORDER BY id DESC', (err, data) => {
						if (err)
							return reject(err);
						else
							id += data.id || 0;

						// Create the actual application
						Core.db.run('INSERT INTO applications (id, owner_id, name, description, subscriptions_enabled, invite_only, hwid_locked) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, auth.id, name, description, subscriptionsEnabled, inviteOnly, hwidLocked], async err => {
							if (err)
								return reject(err);
							else {
								var app = await App.get(id);
								Core.logger.debug(`Created app ${app.format} with owner ${app.owner.format}`);
								return resolve(app);
							}
						})
					})
				});
			});
		})
	}

	/**
   * Get an application by name
   * @param {string} name Application name
   * @param {boolean} omitOwner Should we remove the owner from the result
   * @returns {Promise<App>} Application found
   */
	static find(name: string, omitOwner: boolean = false): Promise<App> {
		return new Promise<App>((resolve, reject) => {
			Core.db.get('SELECT * FROM applications WHERE name = ?', [name], (err, data) => {
				if (err)
					return reject(err)
				else if (!data)
					return reject('Unknown application');
				else
					this.fill(data, omitOwner).then(resolve); // No catch, because nothing can reject, its just formatting
			})
		})
	}

	/**
	 * Get an application by ID
	 * @param {number} id Application ID
	 * @param {boolean} omitOwner Should we remove the owner from the result
	 * @returns {Promise<App>} Application found
	 */
	static get(id: number, omitOwner: boolean = false): Promise<App> {
		return new Promise<App>((resolve, reject) => {
			// check if application already exists in _db
			Core.db.get('SELECT * FROM applications WHERE id = ?', [id], (err, data) => {
				if (err)
					return reject(err);
				// if it doesn't exist, throw an error
				else if (!data)
					return reject('Unknown application');
				else
					this.fill(data, omitOwner).then(resolve); // No catch, because nothing can reject, its just formatting
			})
		})
	}

	static list(auth: User): Promise<App[]> {
		return new Promise((resolve, reject) => {
			if (!auth.permissions.has(FLAGS.ADMIN))
				return reject('Invalid permissions');

			Core.db.all('SELECT * FROM applications', async (err, data) => {
				if (err)
					return reject(err);

				let list: App[] = [];
				for (var x = 0;x < data.length;x++) {
					let filled = await App.fill(data[x], auth.id == data[x].owner_id);
					if (auth.id == data[x].owner_id)
						filled.owner = auth;

					list.push(filled);
				}
			
				return resolve(list);
			})
		})
	}

	/**
	 * Fill in an application class from raw SQL data
	 * @param {any} data Raw SQL output
	 * @param {boolean} omitOwner Do not add owner to the class (can prevent infinite loops)
	 * @returns {Promise<App>} Application that was filled in
	 */
	private static fill(data: any, omitOwner: boolean): Promise<App> {
		return new Promise<App>(async (resolve, _) => {
			var app = new App();

			// Set the properties from the db
			if (!omitOwner) {
				try {
					app.owner = await User.get({ id: data.id } as App, data.owner_id);
				} catch { }
			}

			app.id = data.id;
			app.name = data.name;
			app.description = data.description || 'No description';
			app.disabled = data.disabled == 1 ? true : false;
			app.disableReason = data.disable_reason || 'No reason';
			app.allowUserSelfDeletion = data.allow_user_self_deletion == 1 ? true : false;
			app.publicSubscriptions = data.subscriptions_public == 1 ? true : false;
			app.multipleSubscriptions = data.subscriptions_multiple == 1 ? true : false;
			app.usersCanCreateFiles = data.users_can_create_files == 1 ? true : false;
			app.inviteOnly = data.invite_only == 1 ? true : false;
			app.subscriptionsEnabled = data.subscriptions_enabled == 1 ? true : false;
			app.hwidLocked = data.hwid_locked == 1 ? true : false;

			return resolve(app);
		})
	}
}