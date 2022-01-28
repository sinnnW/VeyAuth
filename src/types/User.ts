import { Auth } from '..';
import { IUser } from './interfaces/IUser';
import { UserPermissions } from './UserPermissions';
import { UserPermissionsArray } from './UserPermissionsArray';
import { App } from './App';
import { Utils } from '../utils/Utils';
import { SecurityHelper } from '../utils/SecurityHelper';

export class User implements IUser {
    authenticated: boolean = false;
    id: number;
    application: App;
    username: string;
    token: string;
    hwid?: string;
    password: string; // The pass hash
    permissions: UserPermissionsArray;
    disabled: boolean = false;
    disableReason?: string = 'No reason';

    constructor() {
        
    }

    static create(auth: User, app: App, username: string, password: string, permissions: UserPermissionsArray) {
        return new Promise<User>((resolve, reject) => {
            // Make sure that username doesn't contain stupid ass unicode or special chars.
            if (Utils.hasSpecialChars(username))
                return reject("Username cannot contain special characters")

            // Make sure the auth user has permissions
            else if (!auth.permissions.has(UserPermissions.FLAGS.CREATE_USERS, app.id))
                return reject("Invalid permissions");

            // If the user supplied a number for the permissions, translate it into a UserPermissionsArray
            else if (typeof permissions === 'number')
                permissions = new UserPermissionsArray(permissions);
                
            // Hash the password
            password = SecurityHelper.hashString(password);

            var id = 0;
            var token: string;
            Auth.db.get('SELECT id FROM users WHERE application_id = ? AND username = ?', [ app.id, username ], (err, data) => {
                if (err)
                    return reject(err);
                else if (data)
                    return reject("Username is already taken");

                Auth.db.get('SELECT id FROM users WHERE application_id = ? ORDER BY id DESC', [ app.id ], (err, data) => {
                    if (err)
                        return reject(err);
                    else if (data)
                        id = data.id + 1;
    
                    let tmpusr = new User();
                    tmpusr.id = id;
                    tmpusr.username = username;
                    tmpusr.password = password;
                    tmpusr.permissions = permissions || new UserPermissionsArray(UserPermissions.FLAGS.USER);
                        
                    token = SecurityHelper.encodeUser(tmpusr);
    
                    Auth.db.run('INSERT INTO users (id, application_id, username, password, token, permissions) VALUES (?, ?, ?, ?, ?, ?)', [ id, app.id, username, password, token, tmpusr.permissions.get(-1).field ], async err => {
                        if (err)
                            return reject(err)
                        else
                            return resolve(await User.get(id));
                    })
                });
            })
        });
    }

    static get(identifier: any): Promise<User> {
        return new Promise(async (resolve, reject) => {
            switch (typeof identifier) {
                case 'string':
                    this.getByToken(identifier).then(resolve).catch(reject);
                    break;
                case 'number':
                    this.getById(+identifier).then(resolve).catch(reject);
                    break;
                default:
                    return reject('Invalid type');
            }
        })
    }

    private static fill(data: any, authed: boolean = false): Promise<User> {
        return new Promise((resolve, reject) => {
            var omit = false;
            Auth.db.get('SELECT owner_id FROM applications WHERE id = ?', [ data.application_id ], async (err, row) => {
                if (err)
                    return reject(err);
                else if (row && row.owner_id == data.application_id)
                    omit = true;

                var usr = new User();
                // Set the properties from the db
                try {
                    usr.application = await App.get(data.application_id, omit);
                } catch (e) {console.error(e)}
                
                if (omit)
                    usr.application.owner = usr;

                usr.id = data.id;
                usr.username = data.username;
                usr.token = data.token;
                usr.hwid = data.hwid;
                usr.permissions = new UserPermissionsArray(data.permissions);//[-1, new UserPermissions(data.permissions)];
                usr.authenticated = authed;
    
                // Application specified permissions
                Auth.db.all('SELECT * FROM permissions WHERE user_id = ?', [ usr.id ], (err2, row2: any) => {
                    if (err2)
                        return reject(err);
                    else if (data) {
                        for (var x = 0;x < data.length;x++)
                            usr.permissions.set(row2.application_id, row2.permissions);
    
                        return resolve(usr);
                    } else
                        return resolve(usr)
                });
            })
        })
    }

    private static async getByToken(token: string): Promise<User> {
        return new Promise<User>((resolve, reject) => {
            // Base user information
            Auth.db.get('SELECT * FROM users WHERE token = ?', [ token ], async (err, data) => {
                if (err)
                    return reject(err);
                else if (!data) // No data, unknown token
                    return reject('Invalid token');

                return resolve(await this.fill(data, true));
            })
    
            return this;
        })
    }

    private static async getById(id: number): Promise<User> {
        return new Promise((resolve, reject) => {
            Auth.db.get('SELECT * FROM users WHERE id = ?', [ id ], async (err ,data) => {
                if (err)
                    return reject(err);
                else if (!data)
                    return reject('Unknown user');
    
                delete data.token;
                return resolve(await this.fill(data));
            })
        })
    }

    recalculateToken()
    {
        if (!this.permissions.has(UserPermissions.FLAGS.MODIFY_USERS, this.application.id))
            throw new Error("Invalid permissions")

        var token = SecurityHelper.encodeUser(this)
        Auth.db.run('UPDATE users SET token = ? WHERE id = ?', [ this.id ], err => {
            if (err)
                throw err;
        })
    }
}