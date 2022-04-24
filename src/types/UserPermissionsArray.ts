import { Core } from '..';
import { BitField } from '../utils/BitField';
import { FLAGS } from './UserPermissions';
import { UserPermissions } from './UserPermissions';
import { User } from './User';

export class UserPermissionsArray {
  permissions: { [key: number]: UserPermissions } = [];
  #currentPermissions: { [key: number]: UserPermissions } = [];

  // # will make this truely private.
  // This is just the user that is the parent
  #parentUser?: User;

  /**
   * 
   * @param {number} permissions Permissions as a number
   * @param {User} parentUser The parent
   */
  constructor(permissions: number, parentUser?: User) {
    this.permissions[-1] = new UserPermissions(permissions ?? FLAGS.USER);
    this.#parentUser = parentUser;
  }

  /**
   * Checks if a user has permission to perform an action on a certain application
   * @param {number} bit Permission bit as a number
   * @param {number} appId Application ID
   * @returns {boolean} Permission status
   */
  has(bit: number, appId: number = -1): boolean {
    // Make sure that parentUser is defined, and that the user is authenticated
    if (!this.#parentUser?.authenticated)
      return false;

    // Global permissions
    var gbf = new BitField(FLAGS, this.#currentPermissions[-1]?.field, [FLAGS.ADMIN]);

    // Application specific permissions
    var bf = new BitField(FLAGS, this.#currentPermissions[appId]?.field, [FLAGS.ADMIN]);


    // See if they have the global permission, the app permission, or are the owner of the app
    if (bf.has(bit) || gbf?.has(bit) || this.#parentUser.application.owner?.id === this.#parentUser?.id)
      return true;
    else
      return false;
  }

  /**
   * Get the permissions as a number for an app
   * @param {number} appId Application ID
   * @returns {UserPermissions} Permissions for the app
   */
  get(appId: number = -1): UserPermissions {
    // Use the current permissions, if they are not there, that means that the permissions var is up to date
    return this.#currentPermissions[appId] || this.permissions[appId];
  }

  /**
   * Set permissions for a user for a certain app
   * @param {number} appId Application ID
   * @param {number} permissions Permissions flag
   * @returns {UserPermissionsArray}
   */
  set(appId: number, permissions: number): UserPermissionsArray {
    if (this.permissions[appId])
      this.permissions[appId].field = permissions;
    else
      this.permissions[appId] = new UserPermissions(permissions);

    return this;
  }

  /**
   * DO NOT USE, THIS IS INTERNAL FUNCTION ONlY, THIS WILL BREAK SHIT
   */
  lockPermissions() {
    this.#currentPermissions = { ...this.permissions };
  }

  /**
   * Save a user's permissions to the database
   * @param {User} auth Authorization
   * @returns {Promise<UserPermissionsArray>} Updated permissions
   */
  save(auth: User): Promise<UserPermissionsArray> {
    return new Promise<UserPermissionsArray>((resolve, reject) => {
      // Make sure the user is authenticated
      if (!auth?.permissions.has(FLAGS.MODIFY_USERS))
        return reject('Invalid permissions');

      for (var x = 0; x < Object.values(this.permissions).length; x++) {
        let key = Object.keys(this.permissions)[x];
        let value = Object.values(this.permissions)[x];

        // Make sure there is a value to set.
        if (!value)
          continue;

        // Make sure that the user forcing permissions update, has permission to grant that permission
        // This is so that someone can't just grant another account permissions they don't have, eg. giving a user admin without having it
        if (!auth.permissions.has(value.field, +key))
          return reject('You cannot give permissions you do not have');


        Core.db.run('REPLACE INTO permissions (application_id, user_id, permissions) VALUES (?, ?, ?)', [key, this.#parentUser?.id, value.field]);
        Core.logger.debug(`Updated ${this.#parentUser?.format} permissions on app ${key} to ${value.field}`);
      }

      // Reset
      this.#currentPermissions = [];
      return resolve(this);
    });
  }

  /**
   * Set the new parent
   * @param {User} parent New parent
   * @returns {UserPermissionsArray} New permissions parent
   */
  setParent(parent: User): UserPermissionsArray {
    this.#parentUser = parent;
    return this;
  }
}