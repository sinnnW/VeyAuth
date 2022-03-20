import { IVariable } from './interfaces/IVariable';
import { Utils } from '../utils/Utils';
import { App } from './App';
import { User } from './User';
import { Core } from '..';
import { FLAGS } from './UserPermissions';

export class Variable implements IVariable {
  key: string;
  value: string;
  private: boolean;
  application: App;
  user?: User;
  
  // This will change if changes were made
  #changes = false;

  // The previous key name
  #prevKeyName: string;

  /**
   * Update a var to a new key
   * @param key New key
   */
  setKey(key: string) {
    if (Utils.hasSpecialChars(key))
      throw new Error('Key cannot contain special characters');

    this.#changes = true;
    this.#prevKeyName = key;
    this.key = key;
  }

  /**
   * Update a vars value
   * @param value New value
   */
  setValue(value: string) {
    this.#changes = true;
    this.value = value;
  }

  /**
   * Change whether the var is private or not
   * @param priv {boolean}
   */
  setPrivate(priv: boolean) {
    this.#changes = true;
    this.private = priv;
  }

  /**
   * Save the pending changes
   * @param auth 
   * @returns {Promise<Var>} Updated var
   */
  save(auth: User): Promise<Variable> {
    return new Promise<Variable>((resolve, reject) => {
      if (!this.#prevKeyName)
        this.#prevKeyName = this.key;

      // If this is true, there are no changes to make
      if (!this.#changes)
        return resolve(this);

      // Make sure that they have permission
      else if (!auth || !auth.permissions.has(FLAGS.MODIFY_VARS, this.application.id))
        return reject('Invalid permissions');

      // Make sure all the required fields are filled
      else if (!this.key || !this.value || (!this.private && this.private !== false))
        return reject('Key, value, and private are required.');

      // Make sure the username doesn't contain special chars
      else if (Utils.hasSpecialChars(this.key))
        return reject('Key cannot contain special characters')

      Core.logger.debug(`Saving variable information for ${this.key}, auth: ${auth.format}`);
      Core.db.get('SELECT * FROM variables WHERE application_id = ? AND user_id = ? AND key = ?', [this.application.id, this.user?.id, this.key], (err, row) => {
        if (err)
          return reject(err);
        else if (row && this.key != this.#prevKeyName)
          return reject(`Key is already taken for user ${this.user?.format} on app ${this.application.format}`);

        // Run all the save commands
        Core.db.serialize(() => {
          // Set the key
          Core.db.run('UPDATE variables SET key = ? WHERE application_id = ? AND user_id = ?', [this.key, this.application.id, this.user?.id]);
          Core.logger.debug('Updated key');

          // Update value
          Core.db.run('UPDATE variables SET value = ? WHERE application_id = ? AND user_id = ?', [this.value, this.application.id, this.user?.id]);
          Core.logger.debug('Updated value');

          // Update private
          Core.db.run('UPDATE variables SET private = ? WHERE application_id = ? AND user_id = ?', [this.private ? 1 : 0, this.application.id, this.user?.id], async () => {
            Core.logger.debug('Updated private');
  
            // Updates were saved
            this.#changes = false;
  
            // Return the updated user
            Core.logger.debug(`Saved variable information for ${this.key} in ${this.application.format} for user ${this.user?.format}`);
            return resolve(this);
          });
        });
      });
    });
  }

  /**
   * Delete the variable
   * @param auth 
   * @returns {Promise<void>}
   */
  delete(auth: User): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!auth?.permissions.has(FLAGS.DELETE_VARS, this.application.id))
        return reject('Invalid permissions');

      Core.db.run('DELETE FROM variables WHERE application_id = ? AND user_id = ? AND key = ?', [ this.application.id, this.user?.id, this.key ], () => {
        return resolve();
      });
    })
  }

  /**
   * Create a new variable from a SQLite return
   * @param rawSql 
   * @returns {Promise<Var>} Finished variable
   */
  static fill(rawSql: any, app?: App | null, user?: User | null): Promise<Variable> {
    return new Promise<Variable>(async (resolve, reject) => {
      var v = new Variable();

      // Set the values
      v.key = rawSql.key;
      v.value = rawSql.value;
      v.private = rawSql.private;

      if (app)
        v.application = app;
      else
        v.application = await App.get(rawSql.application_id);
  
      if (user)
        v.user = user;
      else if (rawSql.user_id)
        v.user = await User.get(rawSql.user_id);

      return resolve(v);
    })
  }

  /**
   * Get a variable for an application/user
   * @param auth 
   * @param app Application it is under
   * @param user User it is under
   * @param key 
   * @returns {Promise<Var>} Variable found
   */
  static get(auth: User | null, app: App, user: User | null, key: string): Promise<Variable> {
    return new Promise((resolve, reject) => {
      Core.db.get(`SELECT * FROM variables WHERE application_id = ? AND user_id ${user?.id ? '=' : 'IS'} ? AND key = ?`, [ app.id, user?.id, key ], async (err, data) => {
        // Make sure there was not an error
        if (err)
          return reject(err);

        // Make sure there was data
        else if (!data)
          return reject('Unknown variable');

        // Make sure it's not private and that they have access to the var if so
        else if (data.private && !auth?.permissions.has(FLAGS.VIEW_PRIVATE_VARS) && auth?.id != user?.id && (auth || user))
          return reject('Variable is private and authenticated user does not have permission to view private variables');

        // All good to return the variable
        else
          return resolve(await Variable.fill(data, app, user));
      })
    })
  }

  static getAll(auth: User): Promise<[Variable]> {
    return new Promise<[Variable]>((resolve, reject) => {
      Core.db.all('SELECT * FROM variables WHERE application_id = ?', [ auth.application.id ], async (err, data: any) => {
        if (err)
          return reject(err);

        let vars = [];
        for (var x = 0;x < data.length;x++) {
          if ((data[x].private && !auth.permissions.has(FLAGS.VIEW_PRIVATE_VARS)) && (auth.id != data[x].user_id))
            continue;

          vars.push(await Variable.fill(data[x], auth.application, auth ));
        }

        return resolve(vars as [Variable]);
      });
    })
  }

  /**
   * Create a new variable for an application/user
   * @param auth 
   * @param app Application to create under
   * @param user User to create under, null for it to be application-wide
   * @param key 
   * @param value 
   * @param priv Private
   * @returns {Promise<Var>} The created variable
   */
  static create(auth: User, app: App, user: User | null, key: string, value: string, priv: boolean): Promise<Variable> {
    return new Promise<Variable>(async (resolve, reject) => {
      // Make sure they have permission
      if (!auth?.permissions.has(FLAGS.CREATE_VARS, app.id))
        return reject('Invalid permissions');

      // This will only get assigned if it got a actual variable
      let v = await Variable.get(auth, app, user, key)
        .catch(() => {});

      // Make sure it doesnt already exist
      if (v)
        return reject('A variable with that name already exists');

      Core.db.run('INSERT INTO variables (application_id, user_id, key, value, private) VALUES (?, ?, ?, ?, ?)', [ app.id, user?.id, key, value, priv ], async err => {
        if (err)
          return reject(err);
        else {
          Core.logger.debug(`Created new variable under app ${app.format} ${user ? `and user ${user.format}` : ''} with key ${key} and value ${value} (private: ${priv})`);
          return resolve(await Variable.get(auth, app, user, key));
        }
      });
    })
  }
}