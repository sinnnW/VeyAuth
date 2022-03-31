import { Core } from '..';
import { IUser } from './interfaces/IUser';
import { FLAGS } from './UserPermissions';
import { UserPermissionsArray } from './UserPermissionsArray';
import { App } from './App';
import { Utils } from '../utils/Utils';
import { SecurityHelper } from '../utils/SecurityHelper';
import { VariableManager } from './VariableManager';

// Import managers
import { SubscriptionManager } from './SubscriptionManager';
import { FileManager } from './FileManager';

enum GET_FLAGS {
  GET_BY_ID,
  // GET_BY_USERNAME,
  GET_BY_TOKEN
};

export class User implements IUser {
  static GET_FLAGS = GET_FLAGS;
  readonly authenticated: boolean = false;
  id: number;
  username: string;
  password: string; // The pass hash, this is readonly because you have to use setPassword()
  token: string;
  hwid?: string;
  permissions: UserPermissionsArray;
  disabled: boolean = false;
  disableReason?: string = 'No reason';
  application: App;

  files: FileManager;
  subscriptions: SubscriptionManager;
  variables: VariableManager;

  // Internal var to detect if there is changes for saving
  #changes = false;
  #deleted = false;

  // Internal var for previous name, since it has to check on save()

  #prevUsername: string | null;

  constructor(authed?: boolean) {
    this.authenticated = authed || false;
  }

  /**
   * @returns {string} Formatted username, ID, and app ID
   */
  get format(): string {
    return `(${this.username} [UID ${this.id}] [AppID ${this.application.id}])`;
  }

  /**
   * Recalculate the users token, good for when you change SESSION_SECRET
   * @param auth
   */
  recalculateToken(auth: User): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (!auth?.permissions.has(FLAGS.MODIFY_USERS, this.application.id))
        return reject('Invalid permissions')

      var token = SecurityHelper.encodeUser(this)
      Core.db.run('UPDATE users SET token = ? WHERE id = ?', [token, this.id], err => {
        if (err)
          return reject(err);
        else {
          Core.logger.debug(`Recalculated token for ${this.format}: ${token}, auth: ${auth.format}`);
          return resolve(token);
        }
      })
    })
  }

  /**
   * Set the disabled state
   * @param disabled true = disabled, false = enabled
   */
  setDisabled(disabled: boolean) {
    this.#changes = true;
    this.disabled = disabled;
  }

  /**
   * Enable the user
   */
  enable() {
    this.setDisabled(false);
  }

  /**
   * Disable the user
   */
  disable() {
    this.setDisabled(true);
  }

  /**
   * Set the disable reason
   * @param reason Reason for being disabled
   */
  setDisableReason(reason: string) {
    this.#changes = true;
    this.disableReason = reason;
  }

  /**
   * Set the username
   * @param username The new username
   */
  setUsername(username: string) {
    if (Utils.hasSpecialChars(username))
      throw new Error('Username cannot contain special characters');

    this.#changes = true;
    this.#prevUsername = this.username;
    this.username = username;
  }

  /**
   * Set the password
   * @param password The new (unhashed) password
   */
  setPassword(password: string) {
    this.#changes = true;
    this.password = password;
  }

  /**
   * Set the HardWare ID
   * @param hwid New HWID
   */
  setHwid(hwid: string) {
    this.#changes = true;
    this.hwid = hwid;
  }

  /**
   * Saves the user
   * @returns {Promise<User>} Updated user
   */
  save(auth: User): Promise<User> {
    return new Promise<User>((resolve, reject) => {
      if (!this.#prevUsername)
        this.#prevUsername = this.username;

      if (this.#deleted)
        return reject('User does not exist');

      // If this is true, there are no changes to make
      else if (!this.#changes)
        return resolve(this);

      // Make sure that they have permission
      else if (!auth || !auth.permissions.has(FLAGS.MODIFY_USERS, this.application.id))
        return reject('Invalid permissions')

      // Make sure all the required fields are filled
      else if (!this.username || !this.password || (!this.disabled && this.disabled !== false))
        return reject('Username, password, and disabled are required.');

      // Make sure the username doesn't contain special chars
      else if (Utils.hasSpecialChars(this.username))
        return reject('Username cannot contain special characters')

      Core.logger.debug(`Saving user information for ${this.format}, auth: ${auth.format}`);
      Core.db.get('SELECT * FROM users WHERE username = ? AND application_id = ?', [this.username, this.application.id], (err, row) => {
        if (err)
          return reject(err);
        else if (row && this.username != this.#prevUsername)
          return reject('Username is already taken');

        // Run all the save commands
        Core.db.serialize(() => {
          // Set the username
          Core.db.run('UPDATE users SET username = ? WHERE id = ?', [this.username, this.id]);
          Core.logger.debug('Updated username');

          // Update password
          Core.db.run('UPDATE users SET password = ? WHERE id = ?', [SecurityHelper.hashString(this.password), this.id]);
          Core.logger.debug('Updated password');

          // Update disabled
          Core.db.run('UPDATE users SET disabled = ? WHERE id = ?', [this.disabled ? 1 : 0, this.id]);
          Core.logger.debug('Updated disabled');

          // Update disable_reason
          Core.db.run('UPDATE users SET disable_reason = ? WHERE id = ?', [this.disableReason == 'No reason' ? null : this.disableReason, this.id]);
          Core.logger.debug('Updated disable_reason');

          // Update HWID
          Core.db.run('UPDATE users SET hwid = ? WHERE id = ?', [this.hwid, this.id], async () => {
            Core.logger.debug('Updated HWID');

            // Recalculate the token, just in case
            await this.recalculateToken(auth);

            // Updates were saved
            this.#changes = false;
            this.#prevUsername = null;

            // Return the updated user
            Core.logger.debug(`Saved user information for ${this.format}`);
            return resolve(this);
          });
        });
      });
    });
  }

  /**
   * This will delete the current user
   * @param User User with permission to delete their profile
   */
  remove(auth: User): Promise<void> {
    this.#deleted = true;
    return User.remove(auth, this);
  }

  static remove(auth: User, user: User): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!auth?.permissions.has(FLAGS.DELETE_USERS) && !(user.application.allowUserSelfDeletion && user.authenticated))
        return reject('Invalid permissions');

      Core.db.serialize(() => {
        Core.db.run('DELETE FROM users WHERE id = ?', [user.id]);
        Core.db.run('DELETE FROM applications WHERE owner_id = ?', [user.id]);
        Core.db.run('DELETE FROM variables WHERE user_id = ?', [user.id]);
        Core.db.run('DELETE FROM permissions WHERE user_id = ?', [user.id], () => {
          Core.logger.debug(`Deleted user ${user.format}`);
          resolve();
        });
      });
    })
  }

  /**
   * Create a user in the database
   * @param auth Coreenticated user
   * @param app Application it will be under
   * @param username
   * @param password
   * @param permissions Permissions they will have
   * @returns {Promise<User>} User created
   */
  static create(auth: User, app: App, username: string, password: string, permissions?: UserPermissionsArray): Promise<User> {
    return new Promise<User>((resolve, reject) => {
      // Make sure the auth user has permissions
      if (!auth.permissions.has(FLAGS.CREATE_USERS, app.id))
        return reject('Invalid permissions');

      // Only allow users to create users in their own application unless they are global users
      else if (auth.application.id != -1 && auth.application.id != app.id)
        return reject('You can only create users in your own application');

      // Make sure that username doesn't contain stupid ass unicode or special chars.
      else if (Utils.hasSpecialChars(username))
        return reject('Username cannot contain special characters');

      // Hash this shit off the bat
      password = SecurityHelper.hashString(password);
      Core.logger.debug(`Creating user ${username}:${password} with global permissions level of ${permissions?.get(-1).field || 0}`);

      // Gotta make sure that the username isn't already taken
      Core.db.get('SELECT id FROM users WHERE application_id = ? AND username = ?', [app.id, username], (err, data) => {
        if (err)
          return reject(err); // Some shitass error.
        else if (data)
          return reject('Username is taken');

        // Fallback ID is 0
        var id = 0;

        // Get the application id
        Core.db.get('SELECT id FROM users WHERE application_id = ? ORDER BY id DESC', [app.id], (err, data) => {
          if (err)
            return reject(err); // This shit really does get repetitive don't it?
          else if (data)
            id = data.id + 1; // Increment the ID by 1 if there was data

          // Create the temp user
          let tmpusr = new User(true);
          tmpusr.application = app;
          tmpusr.id = id;
          tmpusr.username = username;
          tmpusr.password = password; // Fucking password hashing, SHA256.

          // If the user supplied a number for the permissions, translate it into a UserPermissionsArray
          if (permissions?.constructor.name === 'UserPermissionsArray')
            tmpusr.permissions = permissions;
          else if (typeof permissions === 'number')
            tmpusr.permissions = new UserPermissionsArray(permissions);
          else
            tmpusr.permissions = new UserPermissionsArray(FLAGS.USER);

          // Save the permissions
          tmpusr.permissions.setParent(tmpusr);
          tmpusr.permissions.save(auth).then(() => {
            // Create a token
            var token = SecurityHelper.encodeUser(tmpusr);

            // Run the database statement to insert to user into the database
            Core.db.run('INSERT INTO users (id, application_id, username, password, token) VALUES (?, ?, ?, ?, ?)', [id, app.id, username, tmpusr.password, token], async err => {
              if (err)
                return reject(err); // Nah.
              else {
                var user = await User.verify(token);

                // Get the user and return it
                Core.logger.debug(`User ${user.format} was successfully created`);
                return resolve(user);
              }
            })
          }).catch(reject)
        });
      })
    });
  }

  /**
   * Verify a username and password, supply token as username, and null as password to try token
   * @param username 
   * @param password 
   * @returns {Promise<User>} User authed
   */
  static verify(username: string, password?: string): Promise<User> {
    return new Promise<User>((resolve, reject) => {
      let af = (user: User) => {
        if (user.application.disabled)
          return reject(user.application.disableReason || 'No reason');
        else if (user.disabled)
          return reject(user.disableReason || 'No reason');
        else
          return resolve(user);
      }

      if (!password) {
        // Base user information
        Core.db.get('SELECT * FROM users WHERE token = ?', [username], async (err, data) => {
          if (err)
            return reject(err);
          else if (!data) // No data, unknown token
            return reject('Invalid auth');
          else
            af(await this.fill(data, true));
        });
      } else {
        Core.db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, SecurityHelper.hashString(password)], async (err, data) => {
          if (err)
            return reject(err);
          else if (!data)
            return reject('Invalid auth');
          else
            af(await this.fill(data, true));
        })
      }
    })
  }

  /**
   * Gets a user by token or ID
   * @param identifier Get by token or ID
   * @returns {Promise<User>} User found
   */
  static get(id: number): Promise<User> {
    return new Promise((resolve, reject) => {
      Core.db.get('SELECT * FROM users WHERE id = ?', [id], async (err, data) => {
        if (err)
          return reject(err);
        else if (!data)
          return reject('Unknown user');

        delete data.token;
        delete data.password;
        return resolve(await this.fill(data));
      })
    })
  }

  // This function will fill out the data returned
  private static fill(data: any, authed: boolean = false): Promise<User> {
    return new Promise((resolve, reject) => {
      var omit = false;
      Core.db.get('SELECT owner_id FROM applications WHERE id = ?', [data.application_id], async (err, row) => {
        if (err)
          return reject(err);
        else if (row && row.owner_id == data.id)
          omit = true;

        var usr = new User(authed);

        try {
          usr.application = await App.get(data.application_id, omit);
        } catch { }

        if (omit)
          usr.application.owner = usr;

        // Set the properties from the db
        usr.id = data.id;
        usr.username = data.username;
        usr.hwid = data.hwid;
        usr.permissions = new UserPermissionsArray(FLAGS.USER, usr);//[-1, new UserPermissions(data.permissions)];
        usr.token = data.token;
        usr.password = data.password;
        usr.disabled = data.disabled == 1 ? true : false;
        usr.disableReason = data.disable_reason;
        // usr.variables = (await Variable.getAll(usr)).filter(itm => itm.user) as Variable[];

        // Managers
        usr.subscriptions = new SubscriptionManager(usr);
        usr.files = new FileManager(usr);
        usr.variables = new VariableManager(usr);

        // Pull the data
        await usr.subscriptions._getData();
        await usr.files._getData();
        await usr.variables._getData();

        // Application specified permissions
        Core.db.all('SELECT * FROM permissions WHERE user_id = ?', [usr.id], (err2, row2: any) => {
          if (err2)
            return reject(err);
          else if (row2) {
            for (var x = 0; x < row2.length; x++)
              usr.permissions.set(row2[x].application_id, row2[x].permissions);

            // Lock in the permissions and return the user
            usr.permissions.lockPermissions();
            return resolve(usr);
          } else
            return resolve(usr)
        });
      })
    })
  }
}