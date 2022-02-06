import { Auth } from '..';
import { BitField } from '../utils/BitField';
import { FLAGS } from './UserPermissions';
import { UserPermissions } from './UserPermissions';
import { User } from './User';

export class UserPermissionsArray {
	permissions: {[key: number]: UserPermissions } = [];
	private parentUser?: User;

	constructor(permissions: number, parentUser?: User) {
		this.permissions[-1] = new UserPermissions(permissions ?? FLAGS.USER);
		this.parentUser = parentUser;
	}

	/**
	 * Checks if a user has permission to perform an action on a certain application
	 * @param bit Permission bit as a number
	 * @param appId Application ID
	 * @returns Permission status
	 */
	has(bit: number, appId: number): boolean {
		// FUCKKKKK ILL FIX THIS LATER
		// TODO: FUCK
		if (!this.parentUser || !this.parentUser.authenticated)
			return false;

		// Global permissions
		var gbf = new BitField(FLAGS, this.permissions[-1]?.field, [ FLAGS.ADMIN ]);
		
		// Application specific permissions
		var bf = new BitField(FLAGS, this.permissions[appId]?.field, [ FLAGS.ADMIN ]);

		// console.log(this.permissions[-1]?.field)
		if (bf.has(bit) || gbf?.has(bit))
			return true;
		else
			return false;
	}

	/**
	 * Get the permissions as a number for an app
	 * @param appId Application ID
	 * @returns Permissions for the app
	 */
	 get(appId: number = -1): UserPermissions {
		return this.permissions[appId];
	}

	/**
	 * Set permissions for a user for a certain app
	 * @param appId Application ID
	 * @param permissions Permissions flag
	 */
	set(appId: number, permissions: number) {
		this.permissions[appId ?? -1].field = permissions;
	}

	/**
	 * Save a user's permissions to the database
	 */
	save() {
		// Make sure the user is authenticated
		if (!this.parentUser || !this.parentUser.authenticated)
			return;

		for (var x = 0;x < Object.values(this.permissions).length;x++) {
			let key = Object.keys(this.permissions)[x];
			let value = Object.values(this.permissions)[x];

			// Make sure there is a value to set.
			if (!value)
				continue;

			Auth.db.run('REPLACE INTO permissions (application_id, user_id, permissions) VALUES (?, ?, ?)', [ key, this.parentUser?.id, value.field ]);
		}
	}

	/**
	 * Set the new parent
	 * @param parent
	 */
	setParent(parent: User) {
		this.parentUser = parent;
	}
}