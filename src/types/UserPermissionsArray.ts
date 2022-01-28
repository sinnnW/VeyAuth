import { getShebang } from 'typescript';
import { BitField } from '../utils/BitField';
import { FLAGS } from './UserPermissions';
import { UserPermissions } from './UserPermissions';

export class UserPermissionsArray {
	permissions: {[key: number]: UserPermissions } = [];

	constructor(permissions: any) {
		this.permissions[-1] = new UserPermissions(permissions);
	}

	// TODO: ADD CHECK TO SEE IF ITS BEEN AUTHED, OR JUST GOTTEN INFO
	has(bit: number, appId: number): boolean {
		// Global permissions
		var gbf = new BitField(FLAGS, this.permissions[-1]?.field, [ FLAGS.ADMIN ]);
		
		// Application specific permissions
		var bf = new BitField(FLAGS, this.permissions[appId]?.field, [ FLAGS.ADMIN ]);

		if (bf.has(bit) || gbf?.has(bit))
			return true;
		else
			return false;
	}

	set(appId: number, permissions: number): void {
		this.permissions[appId].field = permissions;
	}

	get(appId: number): UserPermissions {
		return this.permissions[appId];
	}
}   