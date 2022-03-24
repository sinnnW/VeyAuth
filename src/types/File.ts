import { IFile } from './interfaces/IFile';
import { User } from './User';
import { App } from './App';
import { Utils } from '../utils/Utils';
import { FLAGS } from './UserPermissions';
import { Core } from '..';

export class File implements IFile {
  id: number;
  disabled: boolean;
  disableReason: string;

  name: string;
  private: boolean;
  application: App;
  user: User;

  #changes = false;
  #deleted = false;
  #prevName: string | null;

  get format(): string {
    return `(File ${this.name} [FileID ${this.id}] [AppID ${this.application.id}] [UserID ${this.user.id}])`;
  }

  rename(name: string) {
    if (Utils.hasSpecialChars(name))
      throw new Error('Name cannot contain special characters');

    this.#changes = true;
    this.name = name;
  }

  setPrivate(priv: boolean) {
    this.#changes = true;
    this.private = priv;
  }

  setDisableReason(reason: string) {
    this.#changes = true;
    this.disableReason = reason;
  }

  save(auth: User): Promise<File> {
    return new Promise<File>((resolve, reject) => {
      if (this.#deleted)
        return reject('File does not exist');

      else if (!this.#prevName)
        this.#prevName = this.name;

			// If this is true, there are no changes to make
			if (!this.#changes)
				return resolve(this);

			// Make sure that they have permission
			else if (!auth?.permissions.has(FLAGS.MODIFY_FILES, this.id))
				return reject('Invalid permissions')

			// Make sure all the required fields are filled
			else if (!this.name || (!this.disabled && this.disabled != false))
				return reject('Name, and disabled are required');

			// Make sure the username doesn't contain special chars
			else if (Utils.hasSpecialChars(this.name))
				return reject('Name cannot contain special characters')

			Core.logger.debug(`Saving file information for ${this.format}, auth: ${auth.format}`);
			Core.db.get('SELECT * FROM files WHERE name = ?', [this.name], (err, row) => {
				if (err)
					return reject(err);
				else if (row && this.name != this.#prevName)
					return reject('Name is already taken');

				// Run all the save commands
				Core.db.serialize(() => {
					// Set the name
					Core.db.run('UPDATE files SET name = ? WHERE id = ?', [this.name, this.id]);
					Core.logger.debug('Updated name');

					// Update disabled
					Core.db.run('UPDATE files SET disabled = ? WHERE id = ?', [this.disabled, this.id]);
					Core.logger.debug('Updated disabled');

					// Update disable_reason
					Core.db.run('UPDATE files SET disable_reason = ? WHERE id = ?', [this.disableReason == 'No reason' ? null : this.disableReason, this.id], async () => {
						Core.logger.debug('Updated disable_reason');

						// Updates were saved
						this.#changes = false;
            this.#prevName = null;

						// Return the updated user
						Core.logger.debug(`Saved file information for ${this.format}`);
						return resolve(this);
					});
				});
      })
    })
  }

  static get(id: number) {

  }

  static find(name: string) {

  }

  private static fill(rawSql: any): Promise<File> {
    return new Promise<File>(async (resolve, _) => {
      let file = new File();

      file.id = rawSql.id;
      file.application = await App.get(rawSql.application_id);
      file.user = await User.get(rawSql.user_id);
      file.name = rawSql.file_name;
      file.private = rawSql.private == 1 ? true : false;

      return resolve(file);
    })
  }
}