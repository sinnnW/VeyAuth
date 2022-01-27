import { IApp } from './interfaces/IApp';
import { IVar } from './interfaces/IVar';
import { IUser } from './interfaces/IUser';
import { User } from './User';
import { Auth } from '..';
import { hasSpecialChars } from '../utils/Validation';

export class App implements IApp {
    // IBase fields
	id: number = NaN;
	disabled: boolean = false;
	disableReason?: string;

    // IApp fields
	name: string = 'No name';
	description: string = 'No description';
	ownerId : number = NaN;

	constructor(id: number) {
        // check if application already exists in _db
		Auth.db.get('SELECT * FROM applications WHERE id = ?', [ id ], (err: any, data: any) => {
			if (err)
				throw err;
			// if it doesn't exist, throw an error
			else if (!data)
				throw new Error('Unknown application');

            // if it does exist, retrieve values from _db  
            // and store in our fields 
			this.id = data.id;
			this.ownerId = data.owner_id;
			this.name = data.name;
			this.description = data.description;
			this.disabled = data.disabled == 1 ? true : false;
			this.disableReason = data.disable_reason;
		})
	}

	// Allow for app creation
    static createApplication(auth: IUser, name: string, description: string = "No description", subscriptionsEnabled: boolean = false, inviteRequired: boolean = false, hwidLocked: boolean = false): IApp
    {
		// Get authenticated user
		var user = new User(auth.token);

        // initalize in _db
		Auth.db.serialize(() => {
			Auth.db.get('SELECT name FROM applications WHERE name = ?', [ name ], (err: any, data: any) => {
				if (err)
					throw err;
				// if it already exists, throw an error
				else if (data)
					throw new Error('Application already exists');
			});
			
			var id: number = 0;
			Auth.db.get("SELECT id FROM applications ORDER BY id DESC", (err, data) => {
				if (err)
					throw err;
				else if (data)
					id = data.id + 1;

				// TODO: SQL TO CREATE APP
				Auth.db.run("INSERT INTO applications (id, owner_id, name, description, subscriptions_enabled, invite_required, hwid_locked) VALUES (?, ?, ?, ?, ?, ?, ?)", [ id, user.id, name, description, subscriptionsEnabled, inviteRequired, hwidLocked], err => {
					if (err)
						throw err;

						
					return new App(id);
				})
			})
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
        if (hasSpecialChars(disableReason))
            throw new Error('Description cannot contain special characters');
        this.disableReason = disableReason;
        this.save();
    }

    // ****** IAPP SETTERS ****** //
    // validate title and store in _db
	setTitle(name: string)
	{
		if (hasSpecialChars(name))
			throw new Error('Title cannot contain special characters');
        this.name = name;
        this.save();
	}    
    // validate description and store in _db
    setDescription(description: string)
	{
		if (hasSpecialChars(description))
			throw new Error('Description cannot contain special characters');
        this.description = description;
        this.save();
	}


    save() {
		// Auth.db.run('UPDATE application SET title = ?, description = ?, disabled = ?, disable_reason = ')
    }

	getUserCount() {
		return 0;
	}

	getVars(authToken: string, hwid: string): [IVar]
    {
        return [{ } as IVar];
    }

    create(name: string, auth: IUser) {
        
    }

}