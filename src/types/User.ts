import { Auth } from '..';
import { IUser } from './interfaces/IUser';
import { BitField } from '../utils/BitField';
import { UserPermissions } from './UserPermissions';

export class User implements IUser {
    id: number;
    applicationId: number;
    username: string;
    token: string;
    hwid?: string;
    password: string; // The pass hash
    permissions: [appId: number, permissions: UserPermissions]; // The permissions
    disabled: boolean = false;
    disableReason?: string;

    constructor(token: string) {
        Auth.db.serialize(() => {
            // Base user information
            Auth.db.get('SELECT * FROM users WHERE token = ?', [ token ], (err: any, data: any) => {
                if (err)
                    throw err;
                else if (!data) // No data, unknown token
                    return 'Invalid token';
    
                // Set all the properties from the db
                this.id = data.id;
                this.applicationId = data.application_id;
                this.username = data.username;
                this.password = data.password;
                this.token = data.token;
                this.hwid = data.hwid;
                this.permissions = [-1, new UserPermissions(data.permissions)];
            })

            // Application specified permissions
            Auth.db.all("SELECT * FROM permissions WHERE user_id = ?", [ this.id ], (err, data) => {
                if (err)
                    throw err;
                else if (data) {
                    for (var x = 0;x < data.length;x++) {
                        this.permissions.push([])
                    }
                }
            });
        })
    }

    recalculateToken() {

    }
}