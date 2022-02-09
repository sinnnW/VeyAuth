import { IVar } from './interfaces/IVar';
import { Utils } from '../utils/Utils';
import { App } from './App';
import { User } from './User';
import { Auth } from '..';
import { FLAGS } from './UserPermissions';

export class Var implements IVar {
  key: string;
  value: string;
  private: boolean;
  application: App;
  user?: User;
  
  // This will change if changes were made
  #changes = false;

  // The previous key name
  #prevKeyName: string;

  setKey(key: string) {
    if (Utils.hasSpecialChars(key))
      throw new Error('Key cannot contain special characters');

    this.#changes = true;
    this.#prevKeyName = key;
    this.key = key;
  }

  setValue(value: string) {
    this.#changes = true;
    this.value = value;
  }

  setPrivate(priv: boolean) {
    this.#changes = true;
    this.private = priv;
  }

  save(auth: User): Promise<Var> {
    return new Promise<Var>((resolve, reject) => {
      if (!this.#prevKeyName)
        this.#prevKeyName = this.key;

      // If this is true, there are no changes to make
      if (!this.#changes)
        return resolve(this);

      // Make sure that they have permission
      else if (!auth || !auth.permissions.has(FLAGS.MODIFY_VARS, this.application.id))
        return reject('Invalid permissions')

      // Make sure all the required fields are filled
      else if (!this.key || !this.value || (!this.private && this.private !== false))
        return reject('Key, value, and private are required.');

      // Make sure the username doesn't contain special chars
      else if (Utils.hasSpecialChars(this.key))
        return reject('Key cannot contain special characters')

      Auth.logger.debug(`Saving variable information for ${this.key}, auth: ${auth.format}`);
      Auth.db.get('SELECT * FROM variables WHERE application_id = ? AND user_id = ? AND key = ?', [this.application.id, this.user?.id, this.key], (err, row) => {
        if (err)
          return reject(err);
        else if (row && this.key != this.#prevKeyName)
          return reject(`Key is already taken for user ${this.user?.format} on app ${this.application.format}`);

        // Run all the save commands
        Auth.db.serialize(() => {
          // Set the key
          Auth.db.run('UPDATE variables SET key = ? WHERE application_id = ? AND user_id = ?', [this.key, this.application.id, this.user?.id]);
          Auth.logger.debug('Updated key');

          // Update value
          Auth.db.run('UPDATE variables SET value = ? WHERE application_id = ? AND user_id = ?', [this.value, this.application.id, this.user?.id]);
          Auth.logger.debug('Updated value');

          // Update private
          Auth.db.run('UPDATE variables SET private = ? WHERE application_id = ? AND user_id = ?', [this.private ? 1 : 0, this.application.id, this.user?.id], async () => {
            Auth.logger.debug('Updated private');
  
            // Updates were saved
            this.#changes = false;
  
            // Return the updated user
            Auth.logger.debug(`Saved variable information for ${this.key} in ${this.application.format} for user ${this.user?.format}`);
            return resolve(this);
          });
        });
      });
    });
  }

  static create(): Promise<Var> {
    return new Promise<Var>((resolve, reject) => {
      
    })
  }
}