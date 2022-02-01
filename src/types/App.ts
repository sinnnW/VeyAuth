import { IApp } from './interfaces/IApp';
import { IVar } from './interfaces/IVar';
import { User } from './User';
import { Auth } from '..';
import { Utils } from '../utils/Utils';

enum GET_FLAGS {
	GET_BY_ID,
	GET_BY_NAME
}

export class App implements IApp {
	// FLAGS
	static GET_FLAGS = GET_FLAGS;

    // IBase fields
	id: number;
	disabled: boolean;
	disableReason?: string;

    // IApp fields
	name: string;
	description: string = 'No description';
	owner : User;

	// We don't use a constructor, since we have all the other methods seperated.
	// This is my attempt at intuition or some shit
	// - verlox @ 1/28/22
	constructor() {}

	// Create an application into the database
    static create(auth: User, name: string, description: string = "No description", subscriptionsEnabled: boolean = false, inviteRequired: boolean = false, hwidLocked: boolean = false)
    {
		return new Promise(async (resolve, reject) => {
			// Get authenticated user
			User.get(auth.token, User.GET_FLAGS.GET_BY_TOKEN)
				.then(user => {
					// initalize in _db
					Auth.db.serialize(() => {
						Auth.db.get('SELECT name FROM applications WHERE name = ?', [ name ], (err: any, data: any) => {
							if (err)
								return reject(err);
							// if it already exists, throw an error
							else if (data)
								return reject('Application already exists');
						});
						
						var id: number = 0;
						Auth.db.get("SELECT id FROM applications ORDER BY id DESC", (err, data) => {
							if (err)
								return reject(err);
							else if (data)
								id = data.id + 1;
			
							// Create application
							Auth.db.run("INSERT INTO applications (id, owner_id, name, description, subscriptions_enabled, invite_required, hwid_locked) VALUES (?, ?, ?, ?, ?, ?, ?)", [ id, user.id, name, description, subscriptionsEnabled, inviteRequired, hwidLocked], err => {
								if (err)
									return reject(err);
								else
									App.get(id, GET_FLAGS.GET_BY_ID).then(resolve).catch(reject);
							});
						})
					});
				})
				.catch(reject);
		})
    }

    
    // ****** IBASE SETTERS ****** //
    // udpated disabled and store in _db
    setDisabled(disabled: boolean)
    {
        this.disabled = disabled;
        this.save();
    }
    // validate disableReason and store in _db
    setDisableReason(disableReason: string)
    {
        if (Utils.hasSpecialChars(disableReason))
            throw new Error('Description cannot contain special characters');
        this.disableReason = disableReason;
        this.save();
    }

    // ****** IAPP SETTERS ****** //
    // validate title and store in _db
	setTitle(name: string)
	{
		if (Utils.hasSpecialChars(name))
			throw new Error('Title cannot contain special characters');
        this.name = name;
        this.save();
	}    
    // validate description and store in _db
    setDescription(description: string)
	{
		if (Utils.hasSpecialChars(description))
			throw new Error('Description cannot contain special characters');
        this.description = description;
        this.save();
	}

	
	getUserCount(): number {
		throw new Error("Not implemented");
	}
	
	getVars(authToken: string, hwid: string): [IVar]
	{
		throw new Error("Not implemented");
	}
	
	// This is the function to fetch an application from the database
	// If the input is a string, try and fetch by name, if its a number,
	// try and fetch by name, else, reject.
	// - verlox @ 1/28/22
	static get(identifier: any, method: GET_FLAGS, omitOwner: boolean = false): Promise<App> {
		return new Promise((resolve, reject) => {
			switch (method) {
				case GET_FLAGS.GET_BY_NAME:
					App.getByName(identifier, omitOwner).then(resolve).catch(reject);
					break;
				case GET_FLAGS.GET_BY_ID:
					App.getById(+identifier, omitOwner).then(resolve).catch(reject);
					break;
				default:
					return reject("Invalid identifier")
			}
		})
	}

	private save() {
		throw new Error("Not implemented");
		// Auth.db.run('UPDATE application SET title = ?, description = ?, disabled = ?, disable_reason = ')
	}

	private static fill(data: any, omitOwner: boolean) { 
		return new Promise<App>(async (resolve, reject) => {
			var app = new App();
    
            // Set the properties from the db
			if (!omitOwner) {
				try {
					app.owner = await User.get(data.owner_id, User.GET_FLAGS.GET_BY_ID);
				} catch {}
			}

			app.id = data.id;
			app.name = data.name;
			app.description = data.description;
			app.disabled = data.disabled == 1 ? true : false;
			app.disableReason = data.disable_reason;

			return resolve(app);
		})
	}

    private static getById(id: number, omitOwner: boolean): Promise<App> {
		return new Promise<App>((resolve, reject) => {
			// check if application already exists in _db
			Auth.db.get('SELECT * FROM applications WHERE id = ?', [ id ], (err, data) => {
				if (err)
					throw err;
				// if it doesn't exist, throw an error
				else if (!data)
					throw new Error('Unknown application');
				else
					this.fill(data, omitOwner).then(resolve); // No catch, because nothing can reject, its just formatting
			})
		})
	}

	private static getByName(name: string, omitOwner: boolean): Promise<App> {
		return new Promise<App>((resolve, reject) => {
			Auth.db.get('SELECT * FROM applications WHERE name = ?', [ name ], (err, data) => {
				if (err)
					return reject(err)
				else if (!data)
					throw new Error('Unknown application');
				else
					this.fill(data, omitOwner).then(resolve); // No catch, because nothing can reject, its just formatting
			})
		})
	}

}