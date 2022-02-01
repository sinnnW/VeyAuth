import { Auth } from '..';
import { IUser } from './interfaces/IUser';
import { UserPermissions } from './UserPermissions';
import { UserPermissionsArray } from './UserPermissionsArray';
import { App } from './App';
import { Utils } from '../utils/Utils';
import { SecurityHelper } from '../utils/SecurityHelper';

enum GET_FLAGS {
    GET_BY_ID,
    // GET_BY_USERNAME,
    GET_BY_TOKEN
};

export class User implements IUser {
    static GET_FLAGS = GET_FLAGS;

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

    /**
     * Recalculate the users token, good for when you change SESSION_SECRET
     */
    recalculateToken() {throw new Error('not implemented, go cry.');
        if (!this.permissions.has(UserPermissions.FLAGS.MODIFY_USERS, this.application.id))
            throw new Error('Invalid permissions')

        var token = SecurityHelper.encodeUser(this)
        Auth.db.run('UPDATE users SET token = ? WHERE id = ?', [ this.id ], err => {
            if (err)
                throw err;
        })
    }

    /**
     * Create a user in the database
     * @param auth Authenticated user
     * @param app Application it will be under
     * @param username
     * @param password
     * @param permissions Permissions they will have
     * @returns Promise<User> created
     */
    static create(auth: User, app: App, username: string, password: string, permissions: UserPermissionsArray): Promise<User> {
        return new Promise<User>((resolve, reject) => {
            // Make sure that username doesn't contain stupid ass unicode or special chars.
            if (Utils.hasSpecialChars(username))
                return reject('Username cannot contain special characters')

            // Make sure the auth user has permissions
            else if (!auth.permissions.has(UserPermissions.FLAGS.CREATE_USERS, app.id))
                return reject('Invalid permissions');

            // If the user supplied a number for the permissions, translate it into a UserPermissionsArray
            else if (typeof permissions === 'number')
                permissions = new UserPermissionsArray(permissions);
            
            // Gotta make sure that the username isn't already taken
            Auth.db.get('SELECT id FROM users WHERE application_id = ? AND username = ?', [ app.id, username ], (err, data) => {
                if (err)
                    return reject(err); // Some shitass error.
                else if (data) // Thats not good
                    return reject('Username is already taken');

                // Fallback ID is 0
                var id = 0;

                // Get the application id
                Auth.db.get('SELECT id FROM users WHERE application_id = ? ORDER BY id DESC', [ app.id ], (err, data) => {
                    if (err)
                        return reject(err); // This shit really does get repetitive don't it?
                    else if (data)
                        id = data.id + 1; // Increment the ID by 1 if there was data
    
                    // Create the temp user
                    let tmpusr = new User();
                    tmpusr.id = id;
                    tmpusr.username = username;
                    tmpusr.password = SecurityHelper.hashString(password); // Fucking password hashing, SHA256.
                    tmpusr.permissions = permissions || new UserPermissionsArray(UserPermissions.FLAGS.USER);
                        
                    // Create a token
                    var token = SecurityHelper.encodeUser(tmpusr);
    
                    // Run the database statement to insert to user into the database
                    Auth.db.run('INSERT INTO users (id, application_id, username, password, token) VALUES (?, ?, ?, ?, ?, ?)', [ id, app.id, username, password, token ], async err => {
                        if (err)
                            return reject(err); // Nah.
                        else {
                            // Save the permissions
                            tmpusr.permissions.save();

                            // Get the user and return it
                            return resolve(await User.get(id, GET_FLAGS.GET_BY_ID));
                        }
                    })
                });
            })
        });
    }

    /**
     * Gets a user by token or ID
     * @param identifier Get by token or ID
     * @returns Promise<User> found
     */
    static get(identifier: any, method: GET_FLAGS): Promise<User> {
        return new Promise(async (resolve, reject) => {
            switch (method) {
                case GET_FLAGS.GET_BY_TOKEN:
                    this.getByToken(identifier).then(resolve).catch(reject);
                    break;
                case GET_FLAGS.GET_BY_ID:
                    this.getById(+identifier).then(resolve).catch(reject);
                    break;
                default:
                    return reject('Invalid type');
            }
        })
    }

    // This function will fill out the data returned
    private static fill(data: any, authed: boolean = false): Promise<User> {
        return new Promise((resolve, reject) => {
            var omit = false;
            Auth.db.get('SELECT owner_id FROM applications WHERE id = ?', [ data.application_id ], async (err, row) => {
                if (err)
                    return reject(err);
                else if (row && row.owner_id == data.id)
                    omit = true;

                var usr = new User();
                
                try {
                    usr.application = await App.get(data.application_id, App.GET_FLAGS.GET_BY_ID, omit);
                } catch (e) {console.error(e)}
                
                if (omit)
                    usr.application.owner = usr;

                // Set the properties from the db
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

    // Get a user by the token
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

    // Get a user by ID
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

    
}