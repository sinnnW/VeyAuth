import { User } from './User';
import { App } from './App';
import { Utils } from '../utils/Utils';
import { FLAGS } from './UserPermissions';
import { Core } from '..';
import { join } from 'path';
import fs from 'fs';

export class File {
  id: number;
  disabled: boolean;
  disableReason: string;

  name: string;
  private: boolean;
  application: App;
  user?: User;

  #changes = false;
  #deleted = false;
  #prevName: string | null;

  /**
   * Return a formatted info string
   * @returns {string} Formatted information
   */
  get format(): string {
    return `(File ${this.name} [FileID ${this.id}] [AppID ${this.application.id}] [UserID ${this.user?.id}])`;
  }

  /**
   * Get the file's data
   * @returns {string} File data read
   */
  get data(): string {
    return fs.readFileSync(join(Core.dataDir, 'uploads', this.application.id.toString(), this.name), 'utf8');
  }

  //#region Modify file properties

  /**
   * Rename the file itself
   * @param {string} name New name
   */
  rename(name: string) {
    if (Utils.hasSpecialChars(name))
      throw new Error('Name cannot contain special characters');

    this.#changes = true;
    this.name = name;
  }

  /**
   * Set whether the file can be accessed by everyone or not
   * @param {boolean} priv Private
   */
  setPrivate(priv: boolean) {
    this.#changes = true;
    this.private = priv;
  }

  /**
   * Set the disabled state
   * @param {boolean} disabled Set application disabled state
   */
  setDisabled(disabled: boolean) {
    this.#changes = true;
    this.disabled = disabled;
  }

  /**
   * Enable access to the file
   */
  enable() {
    this.setDisabled(false);
  }

  /**
   * Disable access to the file
   */
  disable() {
    this.setDisabled(true);
  }

  /**
   * Set the disable reason
   * @param {string} reason Set disable reason
   */
  setDisableReason(reason: string) {
    this.#changes = true;
    this.disableReason = reason;
  }

  /**
   * Save any changed items
   * @param {User} auth
   * @return {Promise<File>} Updated file information
   */
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
					Core.db.run('UPDATE files SET file_name = ? WHERE id = ?', [this.name, this.id]);
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


  /**
   * Delete the current file
   * @param {User} auth Authorization 
   * @returns {Promise<void>} File deletion
   */
  delete(auth: User): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!auth?.permissions.has(FLAGS.DELETE_FILES))
        return reject('Invalid permissions');

      Core.db.run('DELETE FROM files WHERE application_id = ? AND id = ?', [this.application.id, this.id], err => {
        if (err)
          return reject(err);

        fs.unlinkSync(join(Core.dataDir, 'uploads', this.application.id.toString(), this.name));

        resolve();
      })
    })
  }

  //#endregion

  /**
   * Create a new file for a user
   * @param {User} auth Authorization
   * @param {App} app Application
   * @param {User} user User
   * @param {string} fileName File name
   * @param {string} data The file's data
   * @param {boolean} priv Private
   * @returns {Promise<File>} File created
   */
  static create(auth: User, app: App, user: User | null, fileName: string, data: string, priv: boolean = true): Promise<File> {
    return new Promise<File>((_, reject) => {
      if (!auth?.permissions.has(FLAGS.UPLOAD_FILES) && !app.usersCanCreateFiles && auth.id == user?.id)
        return reject('Invalid permissions');

      else if (Utils.hasSpecialChars(fileName))
        return reject('File name cannot contain special characters');

      // Make sure the uploads directory exists
      if (!fs.existsSync(join(Core.dataDir, 'uploads')))
        fs.mkdirSync(join(Core.dataDir, 'uploads'));
      
      if (!fs.existsSync(join(Core.dataDir, 'uploads', app.id.toString())))
        fs.mkdirSync(join(Core.dataDir, 'uploads', app.id.toString()));

      let filePath = join(Core.dataDir, 'uploads', app.id.toString(), fileName);
      fs.writeFileSync(filePath, data);

      return this.register(auth, app, user, filePath, priv);
    })
  }

  /**
   * Register an already existing file as a file for a user/application
   * @param {User} auth Authorization
   * @param {App} app Application
   * @param {User} user User
   * @param {string} fileName Full path to file
   * @param {boolean} priv Private
   * @returns {Promise<File>} File registered
   */
  static register(auth: User, app: App, user: User | null, fileName: string, priv: boolean): Promise<File> {
    return new Promise<File>((resolve, reject) => {
      if (!auth?.permissions.has(FLAGS.UPLOAD_FILES) && !app.usersCanCreateFiles && auth.id == user?.id)
        return reject('Invalid permissions');

      if (!fs.existsSync(fileName))
        return reject('File not found');

      Core.db.get('SELECT id FROM files WHERE application_id = ? ORDER BY id DESC', [ app.id ], (err, data) => {
        if (err)
          return reject(err);

        let id = (data?.id || 0) + 1; 

        Core.db.run('INSERT INTO files (id, application_id, user_id, file_name, private) VALUES (?, ?, ?, ?, ?)', [id, app.id, user?.id, fileName, priv], async err => {
          if (err)
            return reject(err);
          
          File.get(auth, id).then(resolve).catch(reject);
        })
      })
    })
  }

  /**
   * Get a file from ID
   * @param {User} auth Authorization
   * @param {number} id File ID
   * @returns {Promise<File>} File found
   */
  static get(auth: User | null, id: number): Promise<File> {
    return new Promise<File>((resolve, reject) => {
      Core.db.get('SELECT * FROM files WHERE application_id = ? AND id = ?', [auth?.application.id, id], async (err, data) => {
        if (err)
          return reject(err);

        let file = await File.fill(data);

        if (!auth?.permissions.has(FLAGS.VIEW_PRIVATE_FILES) && file.private && !auth?.application.usersCanCreateFiles)
          return reject('Invalid permissions');

        return resolve(file);
      })
    })
  }

  /**
   * Get a file from name
   * @param {User} auth Authorization
   * @param {string} fileName File name
   * @returns {Promise<File>} File found
   */
  static find(auth: User | null, fileName: string): Promise<File> {
    return new Promise<File>((resolve, reject) => {
      Core.db.get('SELECT * FROM files WHERE application_id = ? AND file_name = ?', [auth?.application.id, fileName], async (err, data) => {
        if (err)
          return reject(err);

        let file = await File.fill(data);

        if (!auth?.permissions.has(FLAGS.VIEW_PRIVATE_FILES) && file.private)
          return reject('Invalid permissions');

        return resolve(file);
      })
    })
  }

  /**
   * Fill in a File class from raw SQL data
   * @param {any} rawSql Raw SQL data
   * @param {User} user User to hold
   * @returns {Promise<File>} File class with filled data
   */
  private static fill(rawSql: any, user?: User): Promise<File> {
    return new Promise<File>(async (resolve, _) => {
      let file = new File();

      file.id = rawSql.id;
      file.application = await App.get(rawSql.application_id);
      file.user = user || await User.get(file.application, rawSql.user_id);
      file.name = rawSql.file_name;
      file.private = rawSql.private == 1 ? true : false;

      return resolve(file);
    })
  }

  /**
   * Get all files for a user
   * @param {User} auth Authorization
   * @returns {Promise<File[]>} All files for the user
   */
  static all(auth: User): Promise<File[]> {
    return new Promise<File[]>((resolve, reject) => {
      Core.db.all('SELECT * FROM files WHERE application_id = ?', [ auth.application.id ], async (err, data) => {
        if (err)
          return reject(err);

        let all: File[] = [];
        for (let f of data) {
          // If file is private and the auth user does not have permission, hide it
          if (f.private && !auth.permissions.has(FLAGS.VIEW_PRIVATE_FILES) && f.user_id != auth.id)
            continue;

          let file = await File.fill(f, auth);
          all.push(file);
        }

        return resolve(all);
      })
    })
  }
}