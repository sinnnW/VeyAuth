import { App } from './App';
import { User } from './User';
import { FLAGS } from './UserPermissions';
import { Utils } from '../utils/Utils';
import { Core } from '..';

export class Invite {
  code: string;
  application: App;
  createdBy: User;
  claimedBy: User | null;
  expires: Date;

  #changes = false;
  #deleted = false;
  #claimed = false;

  /**
   * Format the invite's data
   */
  get format(): string {
    return `([Code ${this.code.split('-').slice(0, this.code.split('-').length - 1).join('-').replace(/[A-Z0-9]/gi, '#')}-${this.code.split('-').slice(this.code.split('-').length - 1, this.code.split('-').length).toString()}] [Inviter: ${this.createdBy.format}] ${this.claimedBy ? `[Claimer: ${this.claimedBy?.format}])` : `[Unclaimed]`}`;
  }

  /**
   * Claim the current invite
   * @param {User} user The user claiming the code
   * @returns {Promise<void>}
   */
  claim(user: User): Promise<void> {
    return Invite.claim(this.application, user, this.code);
  }

  /**
   * Set invite expiration
   * @param {Date} expires Set expiration of the invite
   */
  setExpiration(expires: Date) {
    this.expires = expires;
    this.#changes = true;
  }

  /**
   * Save all changes to the invite
   * @param {User} auth Authorization
   * @returns {Promise<Invite>} Updated invitation
   */
  save(auth: User): Promise<Invite> {
    return new Promise<Invite>((resolve, reject) => {
      if (this.#deleted)
        return reject('Invite does not exist');

			// If this is true, there are no changes to make
			if (!this.#changes)
				return resolve(this);

			// Make sure that they have permission
			else if (!auth?.permissions.has(FLAGS.MODIFY_INVITES, this.application.id) && this.application.owner.id != auth.id)
				return reject('Invalid permissions')

			// Make sure all the required fields are filled
			else if (!this.expires)
				return reject('Expires is required');

      // Run all the save commands
      Core.logger.debug(`Saving invite information for ${this.format}, auth: ${auth.format}`);
      Core.db.serialize(() => {
        // Update expires_at
        Core.db.run('UPDATE invites SET expires_at = ? WHERE for_application_id = ? AND code = ?', [this.expires.getTime() / 1000, this.application.id, this.code], async () => {
          Core.logger.debug('Updated disable_reason');

          // Updates were saved
          this.#changes = false;

          // Return the updated user
          Core.logger.debug(`Saved invite information for ${this.format}`);
          return resolve(this);
        });
      });
    });
  }
  
  /**
   * Delete the invite
   * @param {User} auth Authorization
   * @returns {Promise<void>}
   */
  delete(auth: User): Promise<void> {
    this.#deleted = true;
    return Invite.delete(auth, this.application, this.code);
  }

  /**
   * Delete an invite code
   * @param {User} auth Authorization
   * @param {App} app Application
   * @param {string} code Invite code
   * @returns {Promise<void>}
   */
  static delete(auth: User, app: App, code: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      let inv = await Invite.get(app, code);
      
      if (!auth?.permissions.has(FLAGS.DELETE_INVITES, app.id) && auth?.id != inv.createdBy.id)
        return reject('Invalid permissions');

      Core.db.run('DELETE FROM invites WHERE for_application_id = ? AND code = ?', [app.id, code], err => {
        if (err)
          return reject(err);

        resolve();
      })
    })
  }

  /**
   * Claim an invite
   * @param {App} app Application
   * @param {User} user User claiming
   * @param {string} code Invite code
   * @returns {Promise<void>} 
   */
  static claim(app: App, user: User, code: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      let inv = await Invite.get(app, code); 
      if (inv.claimedBy != null)
        return reject('Invite has already been claimed');
      
      Core.db.run('UPDATE invites SET claimed_by = ? WHERE for_application_id = ? AND code = ?', [user.id, app.id, code], err => {
        if (err)
          return reject(err)
        
        resolve();
      });
    })
  }

  /**
   * Generate an invite code
   * @param {App} app Application
   * @returns {Promise<string>} Generated code
   */
  static #generateCode(app: App): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let codeSegments = [];
      for (var x = 0;x < 3;x++)
        codeSegments.push(Utils.createString(5, true, true, false).toUpperCase());

      let code = codeSegments.join('-');

      Core.db.get('SELECT * FROM invites WHERE for_application_id = ? AND code = ?', [ app.id, code ], async (err, data) => {
        if (err)
          return reject(err);
        else if (data)
          return resolve(await this.#generateCode(app));

        return resolve(code);
      })
    })
  }

  /**
   * Get an invite by code
   * @param {App} app Application
   * @param {string} code Invite code 
   * @returns {Promise<Invite>} Invite found
   */
  static get(app: App, code: string): Promise<Invite> {
    return new Promise<Invite>((resolve, reject) => {
      Core.db.get('SELECT * FROM invites WHERE for_application_id = ? AND code = ?', [app.id, code], async (err, data) => {
        if (err)
          return reject(err);
        else if (!data)
          return reject('Unknown invite')

        return resolve(await this.fill(data));
      })
    })
  }

  /**
   * Get all invites that a user has generated
   * @param auth Authorization or user
   * @param user User to check
   * @returns {Promise<Invite[]>} Invites generated
   */
  static getAll(auth: User, user?: User): Promise<Invite[]> {
    return new Promise<Invite[]>((resolve, reject) => {
      if (!user)
        user = auth;
      else if (auth.id != user.id && auth.permissions.has(FLAGS.VIEW_INVITES, user.application.id))
        return reject('Invalid permissions');

      let invs: Invite[] = [];

      Core.db.all('SELECT * FROM invites WHERE for_application_id = ? AND created_by = ?', [ user.application.id, user.id ], async (err, data) => {
        if (err)
          return reject(err);

        for (let x = 0;x < data.length;x++) {
          let i = await Invite.fill(data[x], user);
          invs.push(i);
        }

        return resolve(invs);
      })
    })
  }

  static getClaimed(auth: User, user?: User): Promise<Invite | null> {
    return new Promise<Invite | null>((resolve, reject) => {
      if (!user)
        user = auth;
      else if (auth.id != user.id && auth.permissions.has(FLAGS.VIEW_INVITES, user.application.id))
        return reject('Invalid permissions');

      Core.db.get('SELECT * FROM invites WHERE for_application_id = ? AND claimed_by = ?', [ user.application.id, user.id ], async (err, data) => {
        if (err)
          return reject(err);

        return resolve(data ? await Invite.fill(data, undefined, user) : null);
      })
    })
  }

  /**
   * Create a new invite
   * @param {User} auth Authorization
   * @param {App} app Application 
   * @param {User} user User to create under
   * @param {Date} expires Expiration 
   * @returns {Promise<Invite>} Invite created
   */
  static create(auth: User, app: App, user?: User, expires?: Date): Promise<Invite> {
    return new Promise<Invite>(async (resolve, reject) => {
      if (!auth?.permissions.has(FLAGS.CREATE_INVITES, app.id))
        return reject('Invalid permissions');

      let code = await this.#generateCode(app);
      Core.db.run('INSERT INTO invites (code, creator_application_id, for_application_id, created_by, expires_at) VALUES (?, ?, ?, ?)', [ code, auth.application.id, app.id, user?.id || auth?.id, (expires?.getDate() || 0) / 1000], async err => {
        if (err)
          return reject(err);

        return this.get(app, code).then(resolve).catch(reject);
      })
    })
  }

  /**
   * Fill in data
   * @param {any} data 
   * @param {User} createdBy User it was created by
   * @param {User} claimedBy User it was claimed by
   * @returns {Promise<Invite>} Invite data filled in
   */
  static fill(data: any, createdBy?: User, claimedBy?: User): Promise<Invite> {
    return new Promise<Invite>(async (resolve, _) => {
      var i = new this();
      i.code = data.code;
      i.application = await App.get(data.for_application_id);
      i.createdBy = createdBy || await User.get(await App.get(data.creator_application_id), data.created_by);
      i.claimedBy = claimedBy || data.claimed_by ? await User.get(i.application, data.claimed_by) : null;
      i.expires = new Date(data.expires_at * 1000);

      return resolve(i);
    })
  }
}