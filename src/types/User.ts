import { Core } from '..';
import { IUser } from './interfaces/IUser';
import { FLAGS } from './UserPermissions';
import { UserPermissionsArray } from './UserPermissionsArray';
import { App } from './App';
import { Utils } from '../utils/Utils';
import { SecurityHelper } from '../utils/SecurityHelper';
import { Invite } from './Invite';

// Import managers
import { SubscriptionManager } from './SubscriptionManager';
import { FileManager } from './FileManager';
import { VariableManager } from './VariableManager';
import { InviteManager } from './InviteManager';

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

  // Managers
  files: FileManager;
  subscriptions: SubscriptionManager;
  variables: VariableManager;
  invites: InviteManager;

  // Internal var to detect if there is changes for saving
  #changes = false;
  #deleted = false;

  // Internal var for previous name, since it has to check on save()

  #prevUsername: string | null;

  constructor(authed?: boolean) {
    this.authenticated = authed || false;
  }

  /**
   * Formatted user information
   * @returns {string} Formatted username, ID, and app ID
   */
  get format(): string {
    return `(${this.username} [UID ${this.id}] [AppID ${this.application.id}])`;
  }

  /**
   * Recalculate the users token, good for when you change SESSION_SECRET
   * @param {User} auth Authorization
   * @returns {Promise<string>} Recalculated token
   */
  recalculateToken(auth: User): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (!auth?.permissions.has(FLAGS.MODIFY_USERS, this.application.id))
        return reject('Invalid permissions')

      this.token = SecurityHelper.encodeUser(this)
      Core.db.run('UPDATE users SET token = ? WHERE application_id = ? AND id = ?', [this.token, this.application.id, this.id], err => {
        if (err)
          return reject(err);
        else {
          Core.logger.debug(`Recalculated token for ${this.format}: ${this.token}, auth: ${auth.format}`);
          return resolve(this.token);
        }
      })
    })
  }

  /**
   * Set the disabled state
   * @param {boolean} disabled Disabled
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
   * @param {string} reason Disable reason
   */
  setDisableReason(reason: string) {
    this.#changes = true;
    this.disableReason = reason;
  }

  /**
   * Set the username
   * @param {string} username Username
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
   * @param {string} password The new (unhashed) password
   */
  setPassword(password: string) {
    this.#changes = true;
    this.password = password;
  }

  /**
   * Set the HardWare ID
   * @param {string} hwid New HWID
   */
  setHwid(hwid: string) {
    this.#changes = true;
    this.hwid = hwid;
  }

  /**
   * Saves the user
   * @param {User} auth Authorization
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
      Core.db.get('SELECT * FROM users WHERE id = ? AND application_id = ?', [this.id, this.application.id], (err, row) => {
        if (err)
          return reject(err);
        else if (row && this.username != this.#prevUsername)
          return reject('Username is already taken');

        // Run all the save commands
        Core.db.serialize(() => {
          // Set the username
          Core.db.run('UPDATE users SET username = ? WHERE application_id = ? AND id = ?', [this.username, this.application.id, this.id]);
          Core.logger.debug('Updated username');

          // Update password
          this.password = SecurityHelper.hashString(this.password);
          Core.db.run('UPDATE users SET password = ? WHERE application_id = ? AND id = ?', [this.password, this.application.id, this.id]);
          Core.logger.debug('Updated password');

          // Update disabled
          Core.db.run('UPDATE users SET disabled = ? WHERE application_id = ? AND id = ?', [this.disabled ? 1 : 0, this.application.id, this.id]);
          Core.logger.debug('Updated disabled');

          // Update disable_reason
          Core.db.run('UPDATE users SET disable_reason = ? WHERE application_id = ? AND id = ?', [this.disableReason == 'No reason' ? null : this.disableReason, this.application.id, this.id]);
          Core.logger.debug('Updated disable_reason');

          // Update HWID
          Core.db.run('UPDATE users SET hwid = ? WHERE application_id = ? AND id = ?', [this.hwid, this.application.id, this.id], async () => {
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
   * @param {User} auth Authorization
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
   * @param {User} auth Authorization Coreenticated user
   * @param {App} app Application it will be under
   * @param {string} username Username
   * @param {string} password Password (unhashed)
   * @param {UserPermissionsArray} permissions Permissions they will have
   * @returns {Promise<User>} User created
   */
  static create(auth: User, app: App, username: string, password: string, permissions?: UserPermissionsArray, inviteCode?: string): Promise<User> {
    return new Promise<User>((resolve, reject) => {
      // Make sure the auth user has permissions
      if (!auth.permissions.has(FLAGS.CREATE_USERS, app.id))
        return reject('Invalid permissions');

      // Only allow users to create users in their own application unless they are global users
      else if (auth.application.id != -1 && auth.application.id != app.id)
        return reject('You can only create users in your own application');

      else if (app.inviteOnly && !inviteCode)
        return reject('Application is invite only. You must supply an invite code to register');

      // Make sure that username doesn't contain stupid ass unicode or special chars.
      else if (Utils.hasSpecialChars(username))
        return reject('Username cannot contain special characters');

      // Hash this shit off the bat
      password = SecurityHelper.hashString(password);

      // If the user supplied a number for the permissions, translate it into a UserPermissionsArray
      if (typeof permissions === 'number')
        permissions = new UserPermissionsArray(permissions);
      else if (!permissions)
        permissions = new UserPermissionsArray(FLAGS.USER);
      Core.logger.debug(`Creating user ${username}:${password} with global permissions level of ${permissions?.get(-1).field || 0}`);

      // Gotta make sure that the username isn't already taken
      Core.db.get('SELECT id FROM users WHERE application_id = ? AND username = ?', [app.id, username], (err, data) => {
        if (err)
          return reject(err); // Some shitass error.
        else if (data)
          return reject('Username is taken');

        // Get the application id
        Core.db.get('SELECT id FROM users WHERE application_id = ? ORDER BY id DESC', [app.id], async (err, data) => {
          if (err)
            return reject(err); // This shit really does get repetitive don't it?

          // Generate the ID
          let id = (data.id || 0) + 1;

          // Create the temp user
          let tmpusr = new User(true);
          tmpusr.application = app;
          tmpusr.id = id;
          tmpusr.username = username;
          tmpusr.password = password; // Fucking password hashing, bcrypt.
          tmpusr.permissions = <UserPermissionsArray>permissions;

          // Make sure invite is valid
          if (app.inviteOnly) {
            let inv = <Invite>await Invite.get(app, inviteCode || '').catch(reject);
            if (!inv)
              return;

            if (inv.claimedBy)
              return reject('Invite has already been claimed');
            else if (inv.expires < new Date() && inv.expires.getTime() != 0)
              return reject('Invite has expired')

            Invite.claim(app, tmpusr, inviteCode || '');
          }

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
   * @param {string} usernameOrToken Username or token
   * @param {string} password Password
   * @returns {Promise<User>} User authenticated
   */
  static verify(usernameOrToken: string, password?: string): Promise<User> {
    return new Promise<User>((resolve, reject) => {
      let af = (user: User) => {
        if (user.application.disabled)
          return reject(user.application.disableReason || 'No reason');
        else if (user.disabled)
          return reject(user.disableReason || 'No reason');
        else
          return resolve(user);
      }

      Core.db.get('SELECT * FROM users WHERE (username = ? AND password = ?) OR token = ?', [usernameOrToken, SecurityHelper.hashString(password || ''), usernameOrToken], async (err, data) => {
        if (err)
          return reject(err);
        else if (!data)
          return reject('Invalid authentication');
        else
          af(await this.fill(data, true));
      })
    })
  }

  /**
   * Gets a user by ID
   * @param {number} id ID
   * @returns {Promise<User>} User found
   */
  static get(app: App, id: number): Promise<User> {
    return new Promise((resolve, reject) => {
      Core.db.get('SELECT * FROM users WHERE application_id = ? AND id = ?', [app.id, id], async (err, data) => {
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

  /**
   * List all users in an application
   * @param {User} auth Authorization
   * @param {App} app Application
   * @returns {User[]} All users
   */
  static list(auth: User, app: App): Promise<User[]> {
    return new Promise((resolve, reject) => {
      if (!auth.permissions.has(FLAGS.MODIFY_USERS, app.id))
        return reject('Invalid permissions');

      Core.db.all('SELECT * FROM users WHERE application_id = ?', [app.id], async (err, data) => {
        if (err)
          return reject(err);

        let list: User[] = [];
        for (var x = 0;x < data.length;x++)
          list.push(await User.fill(data[x]));

        return resolve(list);
      })
    });
  }

  /**
   * Fill in a User class from raw SQL data
   * @param {any} data Raw SQL data
   * @param {boolean} authed Authenticated
   * @returns {Promise<User>} User class filled in with data
   */
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
        usr.permissions = new UserPermissionsArray(FLAGS.USER, usr);//[-1, new UserPermissions(data.permissions)];
        usr.disabled = data.disabled == 1 ? true : false;
        usr.disableReason = data.disable_reason;
        // usr.variables = (await Variable.all(usr)).filter(itm => itm.user) as Variable[];

        if (authed) {
          // Sensitive information
          usr.hwid = data.hwid;
          usr.token = data.token;
          usr.password = data.password;

          // Managers
          usr.subscriptions = new SubscriptionManager(usr);
          usr.files = new FileManager(usr);
          usr.variables = new VariableManager(usr);
          usr.invites = new InviteManager(usr);
  
          // Pull the data
          await usr.subscriptions._getData();
          await usr.files._getData();
          await usr.variables._getData();
          await usr.invites._getData();
        }

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