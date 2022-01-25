const crypto = require("crypto");
const sqlite = require('sqlite3');
const fs = require("fs");

module.exports.db = new sqlite.Database(`${__dirname}/../databases/auth.db`);

// These are the different modules
module.exports.app = {};
module.exports.user = {};
module.exports.invite = {};
module.exports.vars = {};
module.exports.files = {};
module.exports.subscriptions = {};

// This is the permissions flags
module.exports.UserPermissions = {
	USER: 0,
	ADMIN: 1,
	CREATE_APPLICATION: 2,

	// User specific permissions
	CREATE_USERS: 4,
	DELETE_USERS: 8,
	MODIFY_USERS: 16,

	// Var specific permission
	CREATE_VARS: 32,
	DELETE_VARS: 64,
	MODIFY_VARS: 128,
	VIEW_PRIVATE_VARS: 256,

	// Invite specific permissions
	CREATE_INVITES: 512,
	DELETE_INVITES: 1024,
	MODIFY_INVITES: 2048,

	// File specific permissions
	UPLOAD_FILES: 4096,
	DELETE_FILES: 8192,
	VIEW_PRIVATE_FILES: 16384,

	BYPASS_HWID_CHECK: 32768,

	// Subscription based permissions
	CREATE_SUBSCRIPTION: 65536,
	DELETE_SUBSCRIPTION: 131072,
	MODIFY_SUBSCRIPTION: 262144,
}

// Here are the standardized codes for rejecting promises.
module.exports.Messages = {
	INVALID_PERMISSIONS: "Invalid permissions.",

	// Login related
	INVALID_CREDENTIALS: "Invalid credentials were provided.",
	ACCOUNT_DISABLED: "Account is disabled.",
	APPLICATION_DISABLED: "Application is disabled.",

	USERNAME_TAKEN: "Username is already taken.",

	USER_DELETED: "User was deleted.",
	APPLICATION_DELETED: "Application was deleted.",

	UNKNOWN_USER: "Unknown user.",
	UNKNOWN_APPLICATION: "Unknown application.",

	NO_DATA: "There was no data returned.",
	ALREADY_EXISTING_KEY: "That key already has data under it.",
	UNKNOWN_KEY: "Unknown key.",
	UNKNOWN_FILE: "Unknown file.",

	FILE_DOESNT_EXIST: "File does not exist.",
	FILE_EXISTS: "File already exists.",
	MISSING_AUTH_KEY: "Missing authentication key.",
	FILE_DELETED: "File was deleted.",
	INVITE_INVALID: "Invalid invite.",
	FAILED_TO_CREATE_INVITE: "Failed to create invite.",
	INVITE_EXPIRED: "Invite is expired.",
	INVITE_CLAIMED: "Invite has already been claimed.",
	INVITE_DELETED: "Invite was deleted.",
	APPLICATION_PUBLIC: "Application is public.",
	INVALID_HWID: "Hardware ID is invalid.",
	VAR_DELETED: "Variable was deleted.",
	SUBSCRIPTIONS_DISABLED: "Subscriptions are disabled.",
	UNKNOWN_SUBSCRIPTION: "Unknown subscription.",
	ALREADY_SUBSCRIBED: "User is already subscribed.",
	SUBSCRIPTION_DELETED: "Subscription was deleted.",
	SUBSCRIPTION_EXPIRED: "Subscription expired.",
}

// Create the uploads directory
if (!fs.existsSync(`${__dirname}/uploads`))
	fs.mkdirSync(`${__dirname}/uploads`);

/*
 | Quick couple of words before the rest of the code:
 | 
 | Conventions:
 |  - When making functions: arguments go in order of biggest scope to smallest, ex - testFunction(applicationId, userId, userAction)
 |  - Make sure everything is dynamically scallable
 |
 | User-application interactions:
 |  - A singular user can own an application
 |  - An application can hold how ever many users
 |  - There are application specific permissions 
 |  - There are private and public vars for applications and users alike.
 |    - Private application vars require an auth token with either VIEW_PRIVATE_VARS or ADMIN permissions to view
 |    - Private user vars require an auth token with either VIEW_PRIVATE_VARS, ADMIN, or is the owner of the account to view
 |    - Public vars can be accessed by anyone
 |  - Invites
 |    - Invites are a WIP
 |  - Admins and universal acccounts
 |    - Universal accounts are marked with application_id = -1
 |    - Application owners are marked with application_id = -2
 |  - User IDs
 |    - They are automatically incremented
 |    - When it is referring to user ID and it's -1, it means it's an application wide item. Example: in files table, user_id = -1, file is application wide.
 */

// #region Internal code. These functions will be used internally ONLY. There is no need to access from beyond.

function modify(ref, changes, protected, adminProtected, auth){
	return new Promise((resolve, reject) => {
		var changesArr = [];
		var failedChanges = [];

		var rk = Object.keys(ref);
		var ck = Object.keys(changes);

		var miss = 0;
	
		// Iterate through each column on the applications table
		for (var x = 0;x < rk.length;x++)
		{
			if (ck.includes(rk[x]))
			{
				// Don't allow the user to change these properties of their account
				if (protected.includes(rk[x])) {
					failedChanges.push(`${rk[x]} - Protected property`)
					continue;
				} else if (adminProtected.includes(ck[x])) // Only allow these properties to be changed by administrators
				{
					// Has permissions
					if ((auth.permissions & module.exports.UserPermissions.ADMIN) === module.exports.UserPermissions.ADMIN)
						changesArr.push([rk[x], changes[rk[x]]]);
					else { // Does not have permission
						failedChanges.push(`${rk[x]} - Admin protected property`);
						continue;
					}
				} else // All the other properties can be changed by the regular user
					changesArr.push([rk[x], changes[rk[x]]]);
			} else
				miss++;
		}

		var r = { changesArr: changesArr, failedChanges: failedChanges, miss: miss };
		return resolve(r);
	})
}

function hasSpecial(str){
	return /[~`!#$%\^&*+=\-\[\]\\';,\/{}|\\":<>\?\ ]/g.test(str)
}

function genStr(len){
	var chars="abcdefghijklmnopqrstuvwxyz";
	var str = "";
	
	for (var x = 0;x < len;x++)
		str += chars[Math.floor(Math.random() * (chars.length - 1))];

	return str;
}

function epoch(){
	var now = new Date();
	return Math.round(now.getTime() / 1000);
}

function rmTree(directory){
	return new Promise((resolve, reject) => {
		var files = fs.readdirSync(directory);
		files.forEach(file => {
			if (fs.statSync(`${directory}/${file}`).isDirectory())
				rmTree(`${directory}/${file}`).then(dir => {
					fs.rmdirSync(dir);
				});
			else
				fs.unlinkSync(`${directory}/${file}`);
		})

		return resolve(directory);
	})
}

// #endregion

// Return the raw db object.
module.exports.getDB = () => {
	return this.db;
}

module.exports.getUserPermissionFlags = () => {
	return this.UserPermissions;
}

// Checks whether a user ID has permissions to do X in Y
// UPDATE: permission param can now accept an array
// UPDATE2: Promise will now be rejected if the user does not have permission.
// CONT: appId can now be null, will just check for user specific permissions.
// UPDATE3: 11/8/2021, return the user object.
module.exports.user.hasPermission = (appId, userId, permission) => {
	return new Promise((resolve, reject) => {
		// Datatype validation
		if (!["number", "object"].includes(typeof(permission)))
			return reject("Permission must be of type number or array");

		// Get user information
		this.user.info(userId)
			.then(user => {
				if (user.disabled == 1 && appId == null)
					return reject(this.Messages.USER_DISABLED);

				if (typeof(permission) == "number") {
					// Check if they have that permission universally.
					if ((user.permissions & permission) === permission)
						return resolve(user.permissions);
					else if ((user.permissions & this.UserPermissions.ADMIN) === this.UserPermissions.ADMIN) // Check for universal admin
						return resolve(user.permissions);
				}

				// No application ID was supplied, no permissions.
				if (appId == null)
					return reject(this.Messages.INVALID_PERMISSIONS);

				// Get information on the application
				this.app.info(appId)
					.then(app => {
						// If the app's owner's ID is the same as the requesting user
						if (app.owner_id != user.id)
						{
							// If the account or the application is disabled, reject the promise.
							if (user.disabled == 1)
								return reject(this.Messages.ACCOUNT_DISABLED);
							else if (app.disabled)
								return reject(this.Messages.APPLICATION_DISABLED);
						} else // Application owner.
							return resolve(user.permissions);

						// The user is the owner of the application
						if (user.id == app.owner_id)
							return resolve(user.permissions);

						// Check the permissions table to see if they have application specific permissions
						this.db.get("SELECT * FROM permissions WHERE user_id = ? AND application_id = ?", [ userId, appId ], (err, row) => {
							if (err)
								return reject(err);
							else if (!row) // No rows were found
								return reject(this.Messages.INVALID_PERMISSIONS);

							if (typeof(permission) == "number") {
								if ((row.permissions & this.UserPermissions.ADMIN) === this.UserPermissions.ADMIN)
									return resolve(user.permissions);
								else if ((row.permissions & permission) === permission) // There was a row and it had valid permissions
									return resolve(user.permissions);
								else // There was a row but there was no valid permissions
									return reject(this.Messages.INVALID_PERMISSIONS);
							}
							else {
								for (var x = 0;x < permission.length;x++) {
									if ((row.permissions & permission[x]) === permission[x]) // There was a row and it had valid permissions
										return resolve(user);
									else // There was a row but there was no valid permissions
										return reject(this.Messages.INVALID_PERMISSIONS);
								}
							}
						})
					})
					.catch(reject); // Reject society, become error.
			})
			.catch(reject);
	})
}

// This will return the row of the user based on the user's ID
module.exports.user.info = (userId, appId, username) => {
	return new Promise((resolve, reject) => {
		if (username)
			username = username.toLowerCase();

		if ((appId || appId == 0) && ((userId || userId == 0) || username))
		{
			this.db.get("SELECT * FROM users WHERE (application_id = ? OR application_id = -1) AND (id = ? OR username = ?)", [ appId, userId, username ], (err, row) => {
				if (err)
					return reject(err);
				else if (!row) // Make sure that there was content returned
					return reject(this.Messages.UNKNOWN_USER);

				// Redact the password and HWID
				delete row.password;
				delete row.hwid;

				this.db.get("SELECT * FROM permissions WHERE application_id = ? AND user_id = ?", [ appId, row.id ], (err, perms) => {
					if (err) reject(err);
					else if (!perms) return resolve(row);

					row.permissions = perms.permissions;

					// return back the row
					resolve(row);
				});

			});
		} else {
			this.db.get("SELECT * FROM users WHERE id = ?", [ userId ], (err, row) => {
				if (err)
					return reject(err);
				else if (!row) // Make sure that there was content returned
					return reject(this.Messages.UNKNOWN_USER);

				// Redact the password and HWID
				delete row.password;
				delete row.hwid;

				// return back the row
				resolve(row);
			 })
		 }
	})
}

// Get the application's information based on it's ID
module.exports.app.info = (appId) => {
	return new Promise((resolve, reject) => {
		this.db.get("SELECT * FROM applications WHERE id = ?", [ appId ], (err, row) => {
			if (err)
				return reject(err);
			else if (!row) // Make sure that there was content returned
				return reject(this.Messages.UNKNOWN_APPLICATION);
	
			// return back the row
			resolve(row);
		})
	})
}

// This will create the actual application
module.exports.app.create = (name, description, authToken, private) => {
	return new Promise((resolve, reject) => {
		//  Mkae sure the datatype is correct
		if (typeof(private) != "boolean")
			return reject("private must be type of boolean");
	
		this.user.verifyToken(authToken, null, null, true)
			.then(auth => {
				this.user.hasPermission(null, auth.id, this.UserPermissions.CREATE_APPLICATION)
					.then(() => {
						// Make sure that theres not an application with that name already
						this.db.get("SELECT * FROM applications ORDER BY id DESC", (err, rawApp) => {
							if (err)
								return reject(err);

							var appId = rawApp ? ++rawApp.id : 0;

							// Actually create the application and insert the data.
							this.db.run("INSERT INTO applications (id, name, description, owner_id, private) VALUES (?, ?, ?, ?, ?)", [ appId, name, description, auth.id, private ? 1 : 0 ], err => {
								if (err)
									return reject(err);
									
								if (!fs.existsSync(`${__dirname}/uploads/${appId}`))
									fs.mkdirSync(`${__dirname}/uploads/${appId}`);


								// Resolve with information, or reject with failure.
								this.app.info(appId).then(resolve).catch(reject);

								// this.db.run("INSERT INTO permissions (application_id, user_id, permissions) VALUES (?, ?, ?)", [ appId, auth.id, this.UserPermissions.ADMIN ], (err) => {
								//   if (err)
								//     return reject(err);

								// });
							});
						});
					})
					.catch(reject)
			})
			.catch(reject);
	});
}

// The authToken is the source token (if the application is not public)
// Refactored 11/8/2021
module.exports.user.create = (username, password, permissions, appId, authToken) => {
	return new Promise((resolve, reject) => {
		if (typeof(permissions) != "number" && (permissions || permissions == 0)) {
			try {
				permissions = parseInt(permissions); 
			} catch {
				return reject("Permissions must be of type number.");
			}
		}

		// Validate the username
		// https://stackoverflow.com/questions/11896599/javascript-code-to-check-special-characters
		// God i fucking love stack overflow. Makes me want to lose NNN again.
		if (hasSpecial(username))
			return reject("Username cannot contain special characters.");

		// Make the username all lowercase
		username = username.toLowerCase();

		// Hash the password
		password = this.hashString(password);

		// this actually creates the user account. 
		function create(authUser, inv){
			return new Promise((resolve, reject) => {
				// Make sure someone doesn't already have that username
				module.exports.db.get("SELECT * FROM users WHERE username = ?", [ username ], (err, result) => {
					if (err) 
						return reject(err);
					else if (result) // Row with content = user already exists
						return reject(module.exports.Messages.USERNAME_TAKEN);
		
					// Get the next ID for the user
					module.exports.db.get("SELECT id FROM users WHERE application_id = ? ORDER BY id DESC", [ appId ], (err, row) => {
						if (err)
							return reject(err);

						// This will be the next user's ID. If there is no previous user, start at 0.
						var id = row ? ++row.id : 0;

						// if there was an authUser passed to this, check the permissions. Else, reset the permissions to user level.
						// TODO: Refactor this. This code is abysmal.
						if (authUser)
						{
							if ((authUser.permissions & module.exports.UserPermissions.CREATE_APPLICATION) == module.exports.UserPermissions.CREATE_APPLICATION && (permissions & module.exports.UserPermissions.CREATE_APPLICATION) === module.exports.UserPermissions.CREATE_APPLICATION)
								appId = -2;

							if ((authUser.permissions & module.exports.UserPermissions.ADMIN) == module.exports.UserPermissions.ADMIN)
							{
								if ((permissions & module.exports.UserPermissions.CREATE_APPLICATION) === module.exports.UserPermissions.CREATE_APPLICATION)
									appId = -2;

								// Try and set the permissions to what we wanted, but fall back to user permissions if it fails.
								try {
									permissions = parseInt(permissions);
								}
								catch {
									permissions = 0;
								}
							} else
								permissions = 0;
						} else
							permissions = 0;

						// Get the user token and insert into the database.
						module.exports.user.calculateToken(username, password).then(token => {
							module.exports.db.run("INSERT INTO users (id, username, password, token, permissions, application_id) VALUES (?, ?, ?, ?, ?, ?)", [ id, username, password, token, permissions, appId ], err => {
								if (err)
									return reject(err);

								// Make an invite as used if the app is private.
								if (inv)
								{
									// Set the claimed_by field to the new user's ID
									module.exports.db.run("UPDATE invites SET claimed_by = ? WHERE invite_code = ?", [ id, inv.invite_code ], err => {
										if (err) return reject(err);

										// Get the user's info and dip
										module.exports.user.info(id).then(resolve).catch(reject);
									})
								} else
									module.exports.user.info(id).then(resolve).catch(reject);
							});
						});
					});
				});
			});
		}

		// get the information on it
		this.app.info(appId).then(app => {
			// Make sure that the application is enabled
			if (app.disabled == 1)
				return reject(this.Messages.APPLICATION_DISABLED);

			// If the application is public and accepting users, we dont need an auth token
			if (app.private == 1)
			{
				if (!authToken)
					return reject("Missing auth token for a private application!");
				
				// Signifies that it is an invite
				if (authToken.includes("-"))
				{
					// Get info on the invite
					this.invite.info(authToken)
						.then(inv => { // Its valid, make it, but null the auth
							create(null, inv).then(resolve).catch(reject);
						})
						.catch(reject); // Not valid. Reject this shit.
				}
				else {
					// Not an invite, checking account token
					this.user.verifyToken(authToken, appId)
						.then(auth => { // Yay, it's valid! unlike gay people.
							create(auth).then(resolve).catch(reject);
						})
						.catch(reject); // Ew thats gay
				}
			} else
				create().then(resolve).catch(reject); // I really dunno if its required, but it's currently working and I know better than to question it.
		}).catch(reject);
	})
}

// Recalculate the token of a user account based on username + password in database.
module.exports.user.recalculateToken = (userId) => {
	return new Promise((resolve, reject) => {
		// Get the username and password of the account matching the ID
		this.db.get("SELECT username, password FROM users WHERE id = ?", [ userId ], (err, row) => {
			if (err)
				return reject(err);
			else if (!row)
				return reject(this.Messages.UNKNOWN_USER);
	
			// Calculate the token
			this.user.calculateToken(row.username, row.password).then(token => {
				// Set the token
				this.db.run("UPDATE users SET token = ? WHERE username = ? AND password = ?", [ token, row.username, row.password ], err => {
					if (err)
						throw err;

					// Get and return the updated user info
					this.user.info(userId)
						.then(resolve)
						.catch(reject);
				})
			})
		})
	})
}

// Recreate a token from the supplied credentials.
module.exports.user.verify = (username, password, hwid, appId) => {
	return new Promise((resolve, reject) => {
		// Redirect to the verifyToken method.
		this.user.calculateToken(username.toLowerCase(), this.hashString(password)).then(token => {
			// Redirect to the other method, less code.
			this.user.verifyToken(token, appId, hwid)
				.then(resolve)
				.catch(reject);
		}).catch(reject);
	})
}

// Verify a user's token is valid
module.exports.user.verifyToken = (token, appId, hwid = "", validTokenOnly) => {
	return new Promise((resolve, reject) => {
		// Check the database
		this.db.get("SELECT * FROM users WHERE token = ?", [ token ], (err, row) => {
			if (err)
				return reject(err);
			
			else if (!row) // No row, invalid
				return reject(this.Messages.INVALID_CREDENTIALS);
			
			function returnInfo() {
				module.exports.user.info(row.id, row.application_id)
					.then(resolve)
					.catch(reject);
			}

			// Redact the password
			delete row.password;

			if (validTokenOnly)
				return returnInfo();

			// -1 means that the user is universal across all applications
			else if (row.application_id == -1)
				return returnInfo();

			// If its an application owner and only checking for a valid token, return
			else if (row.application_id == -2)
					return returnInfo();

			// If there's no app ID, reject.
			else if (!appId && appId != 0)
				return reject(this.Messages.INVALID_CREDENTIALS);
					
			this.app.info(appId)
				.then(app => {
					// Application ID = -2 on a user means they can own applications.
					if (row.application_id == -2 && app && row.id == app.owner_id) 
						return returnInfo();
	
					// More validations, I'm really losing the will to comment this shit, because at this point, it's too late, and I'm starting to feel like robby.
					else if (appId && appId != 0 && appId != row.application_id)
						return reject(this.Messages.INVALID_CREDENTIALS);
	
					// Shits disabled. Just like my brain.
					else if (row.disabled == 1)
						return reject(this.Messages.ACCOUNT_DISABLED);

					// This will allow only the owner to sign in on disabled applications.
					else if (app.disabled == 1 && row.id != app.owner_id)
						return reject(this.Messages.APPLICATION_DISABLED);
		
					this.db.get("SELECT permissions FROM permissions WHERE user_id = ? AND application_id = ?", [ row.id, appId ], (err, permRow) => {
						if (err)
							return reject(err);

						// Override the global permissiosn with application specific permissions if available (ONLY IF NOT AN ADMIN AND THE ROW EXISTS)
						if (permRow && (row.permissions && this.UserPermissions.ADMIN) !== this.UserPermissions.ADMIN)
							row.permissions = permRow.permissions;

							// Check and make sure HWID is valid and that they're not an admin.
						if (((row.permissions && this.UserPermissions.BYPASS_HWID_CHECK) !== this.UserPermissions.BYPASS_HWID_CHECK && (row.permissions && this.UserPermissions.ADMIN) !== this.UserPermissions.ADMIN) && app.hwidRequired == 1)
						{
							if (row.hwid == null)
							{
								if (hwid == null)
									return reject("HWID cannot be null");

								// Set the HWID if null
								this.db.run("UPDATE users SET hwid = ? WHERE id = ?", [ hwid, row.id ], err => {
									if (err) return reject(err);
								})
							} else if (row.hwid != hwid)
								return reject(this.Messages.INVALID_HWID);
						}

						// No other errors, account is fine.
						return returnInfo();
					});
				})
				.catch(reject);
		})
	})
}

// Delete a user, requires an administrators auth token.
// Fixed 11/8/2021, was missing appId param, causing issues
module.exports.user.delete = (appId, userId, authToken) => {
	return new Promise((resolve, reject) => {
		// Get user from token
		this.user.verifyToken(authToken, appId)
			.then(admin => {
				// Old permissions checking
				// TODO: Refactor.
				if ((admin.permissions & this.UserPermissions.ADMIN) !== this.UserPermissions.ADMIN && admin.id != userId)
					return reject(this.Messages.INVALID_PERMISSIONS);

				// Delete owned applications
				this.db.run("DELETE FROM applications WHERE owner_id = ?", [ userId ], err => {
					if (err)
						return reject(err);

					// Delete the account
					this.db.run("DELETE FROM users WHERE id = ?", [ userId ], err => {
						if (err)
							return reject(err);
						
						// Delete permissions pertaining to their account
						this.db.run("DELETE FROM permissions WHERE user_id = ?", [ userId ], err => {
							if (err)
								return reject(err);

							// Delete any vars that corrolate to them
							this.db.run("DELETE FROM vars WHERE user_id = ?", [ userId ], err => {
								if (err)
									return reject(err);
						
								// Delete their invites
								this.db.run("DELETE FROM invites WHERE owner_id = ?", [ userId ], err => {
									if (err)
										return reject(err);
										
										this.db.run("DELETE FROM subscriptions WHERE user_id = ?", [ userId ], err => {
											if (err)
												return reject(err);
											
											// Get all file records
											this.db.all("SELECT * FROM files WHERE user_id = ?", [ userId ], (err, files) => {
												if (err)
													return reject(err);
	
												// Delete all the files themselves
												if (fs.existsSync(`${__dirname}/uploads/${appId}/${userId}`))
												{
													// Just reading the dir and deleting shit. Its not rocket science.
													files.forEach(f => {
														fs.unlinkSync(`${__dirname}/uploads/${appId}/${userId}/${f.file}`);
													})
												}
											
												// Delete their records
												this.db.run("DELETE FROM files WHERE user_id = ?", [ userId ], err => {
												if (err)
													return reject(err);
	
												// No error = user was deleted
												return resolve(this.Messages.USER_DELETED);
											});
										})
									});
								});
							});
						});
					});
				});
			})
			.catch(reject); // If there is an error, reject the promise.
	})
}

// Delete an application, requires an administrators auth token.
module.exports.app.delete = (appId, authToken) => {
	return new Promise((resolve, reject) => {
		this.user.verifyToken(authToken, appId)
			.then(admin => {
				this.app.info(appId)
					.then(app => {
						if ((admin.permissions & this.UserPermissions.ADMIN) !== this.UserPermissions.ADMIN && admin.id != app.owner_id)
							return reject("Invalid permissions.");

						// Delete it from the applications table
						this.db.run("DELETE FROM applications WHERE id = ?", [ appId ], err => {
							if (err) // If there was an error, reject the promise and cancel the rest of execution.
								return reject(err);

							// Delete all its users.
							this.db.run("DELETE FROM users WHERE application_id = ?", [ appId ], err => {
								if (err) return reject(err);

								// Delete permissions for it.
								this.db.run("DELETE from permissions WHERE application_id = ?", [ appId ], err => {
									if (err) return reject(err);

									// Delete its vars.
									this.db.run("DELETE FROM vars WHERE application_id = ?", [ appId ], err => {
										if (err) return reject(err);

										// Delete any invites for it.
										this.db.run("DELETE FROM invites WHERE application_id = ?", [ appId ], err => {
											if (err) return reject(err);

											this.db.run("DELETE FROM subscriptions WHERE application_id = ?", [ appId ], err => {
												if (err)
													return reject(err);

												rmTree(`${__dirname}/uploads/${appId}`)
													.then(() => {
														// Delete their records
														this.db.run("DELETE FROM files WHERE application_id = ?", [ appId ], err => {
															if (err)
																return reject(err);
			
															// No error = user was deleted
															return resolve(this.Messages.APPLICATION_DELETED);
														})
													})
													.catch(reject);
												});
										});
									})
								})
							})
						})
					})
					.catch(reject);
			})
			.catch(reject); // If there is an error, reject the promise.
	})
}

// Modifying users. I'm pretty sure this took a couple hours to write so that it would be dynamically scallable. I fucking hate everything about this.
// UPDATE 11/8/2021: More dynamic shit. God I fucking hate modifying values.
module.exports.user.modify = (appId, userId, authToken, changes) => {
	return new Promise((resolve, reject) => {
		// Datatype validation
		if (typeof(changes) != "object")
			return reject("Changes must be type of object");

		this.user.verifyToken(authToken, appId)
			.then(auth => {
				// hp = Has permission
				function hp() {
					// Get information on the user's account
					module.exports.user.info(userId)
						.then(user => {
							user.password = ""; // Add password field so that it can be changed.
							user.hwid = "";
							modify(user, changes, ["id", "token", "username"], ["permissions", "application_id", "disabled", "hwid"], auth)
								.then(mod => {
									if (mod.changesArr.length == 0)
										module.exports.user.info(userId)
											.then(resolve)
											.catch(reject);

									// This actually updates the values
									for (var x = 0;x < mod.changesArr.length;x++)
									{
										module.exports.db.run(`UPDATE users SET ${mod.changesArr[x][0]} = ? WHERE id = ?`, [ mod.changesArr[x][0] == "password" ? module.exports.hashString(mod.changesArr[x][1]) : mod.changesArr[x][1], userId ], err => {
											if (err)
												return reject(err);

											if (x == mod.changesArr.length && Object.keys(changes).includes("password"))
												module.exports.user.recalculateToken(userId)
													.then(resolve)
													.catch(reject);
											else if (x == mod.changesArr.length)
												module.exports.user.info(userId)
													.then(resolve)
													.catch(reject);
										});
									}
								})
								.catch(reject);
						})
						.catch(reject)
				}

				if (auth.id == userId)
					hp();
				else { // Get the auth token information
					
					// Make sure that the permissions are valid, AKA if they have admin / are the owner of the account
					this.user.hasPermission(appId, auth.id, this.UserPermissions.MODIFY_USERS)
						.then(() => {
							hp();
						})
						.catch(reject);
					}
			})
			.catch(reject);
	})
}

// Also equally fucking hate this one.
module.exports.app.modify = (appId, authToken, changes) => {
	return new Promise((resolve, reject) => {
		if (typeof(changes) != "object")
			return reject("Changes must be type of object");

		this.user.verifyToken(authToken, appId)
			.then(auth => {
				this.app.info(appId)
				 .then(app => {
						function hp()
						{
							modify(app, changes, ["id"], ["owner_id"], auth)
								.then(mod => {
									// This actually updates the values
									for (var x = 0;x < mod.changesArr.length;x++)
										module.exports.db.run(`UPDATE applications SET ${mod.changesArr[x][0]} = ? WHERE id = ?`, [ mod.changesArr[x][1], app.id ], err => { if (err) return reject(err)});

									// This returns and says whether the changes were successful or not, and how many fails there were (if any)
									module.exports.app.info(appId)
										.then(resolve)
										.catch(reject);
								})
								.catch(reject);
						}

						if (auth.id == app.owner_id)
							hp();
						else {
							this.user.hasPermission(appId, auth.id, this.UserPermissions.ADMIN)
								.then(() => {
									hp();
								})
								.catch(reject);
						}
					})
					.catch(reject);        
			})
			.catch(reject);
	})
}

// Get the public variables for an application.
module.exports.app.getPublicVars = (appId) => {
	return new Promise((resolve, reject) => {
		this.db.all("SELECT * FROM vars WHERE private = 0 AND application_id = ? AND user_id = -1", [ appId ], (err, rows) => {
			if (err)
				return reject(err);
			
			return resolve(rows);
		})
	});
}

// Get the public variables for a user.
module.exports.user.getPublicVars = (appId, userId) => {
	return new Promise((resolve, reject) => {
		this.db.all("SELECT * FROM vars WHERE private = 0 AND application_id = ? AND user_id = ?", [ appId, userId ], (err, rows) => {
			if (err)
				return reject(err);
			
			return resolve(rows);
		})
	});
}

// Get the private variables for an app. Must be retrieved by an admin.
module.exports.app.getPrivateVars = (appId, authToken, hwid) => {
	return new Promise((resolve, reject) => {
		this.user.verifyToken(authToken, appId, hwid)
			.then(auth => {
				this.user.hasPermission(appId, auth.id, this.UserPermissions.ADMIN)
					.then(() => {
						this.db.all("SELECT * FROM vars WHERE private = 1 AND application_id = ? AND user_id = -1", [ appId ], (err, rows) => {
							if (err)
								return reject(err);
							
							return resolve(rows);
						});
					})
					.catch(reject);
			})
			.catch(reject);
	});
}

// Get the private variables for a user. Can be retrieved by an admin or the user themself.
module.exports.user.getPrivateVars = (appId, userId, authToken, hwid) => {
	return new Promise((resolve, reject) => {
		this.user.verifyToken(authToken, appId, hwid)
			.then(auth => {
				this.user.hasPermission(appId, auth.id, this.UserPermissions.ADMIN)
					.then(() => {
						this.db.all("SELECT * FROM vars WHERE private = 1 AND application_id = ? AND user_id = ?", [ appId, userId ], (err, rows) => {
							if (err)
								return reject(err);

							return resolve(rows);
						});
					})
					.catch(reject);
			})
			.catch(reject);
	});
}

// #region Vars section. This is all variable control.

module.exports.vars.exists = (appId, userId, key) => {
	return new Promise((resolve, reject) => {
		this.db.get("SELECT key FROM vars WHERE application_id = ? AND user_id = ? AND KEY = ?", [ appId, userId, key ], (err, row) => {
			if (err) // Reject errors
				return reject(err);
			else if (!row) // If there is no rows, resolve with false
				return resolve(false);
			else
				return resolve(true);
		})
	});
}

// Get a var.
module.exports.vars.get = (appId, userId, key, authToken, hwid) => {
	return new Promise((resolve, reject) => {
		// Get the application var that matches the key
		this.db.get("SELECT * FROM vars WHERE application_id = ? AND user_id = ? AND key = ?", [ appId, userId, key ], (err, row) => {
			if (err) // Reject errors
				return reject(err);
			else if (!row) // If there is no rows, reject with UNKNOWN_KEY code
				return reject(this.Messages.UNKNOWN_KEY);
			else if (row.private == 0) // If it isn't private, return it
				return resolve(row);

			// This means it was private var. Verify the auth token.
			this.user.verifyToken(authToken, appId, hwid)
				.then(auth => {
					// Get information on the app
					this.app.info(appId)
						.then(app => {
							// Make sure that the owner of the app and the account can view vars
							if (auth.id == app.owner_id || auth.id == userId)
								return resolve(row);

							// Check permissions as a last ditch effort.
							this.user.hasPermission(appId, auth.id, this.UserPermissions.VIEW_PRIVATE_VARS)
								.then(() => {
									resolve(row); // Hey look at that! Some data.
								})
								.catch(reject);
						})
						.catch(reject);
					})
					.catch(reject);
		});
	});
}

// Create a variable
module.exports.vars.create = (appId, userId, key, value, private, authToken, hwid) => {
	return new Promise((resolve, reject) => {
		if (typeof(private) != "boolean")
			return reject("Private must be type of boolean");
		
		if (hasSpecial(key))
			return reject("Key cannot contain special characters.");
			
		this.user.verifyToken(authToken, appId, hwid)
			.then(auth => {
				this.vars.get(appId, userId, key, authToken, hwid)
					.then(() => {
						return reject(this.Messages.ALREADY_EXISTING_KEY)
					})
					.catch(data => {
						if (data != this.Messages.UNKNOWN_KEY)
							return reject(data);

						this.app.info(appId)
							.then(app => {
								function cv() {
									module.exports.db.run("INSERT INTO vars (application_id, user_id, key, value, private) VALUES (?, ?, ?, ?, ?)", [ appId, userId, key, value, private ? 1 : 0 ], err => {
										if (err) return reject(err);

										module.exports.vars.get(appId, userId, key, authToken)
											.then(resolve)
											.catch(reject);
									})
								}
		
								if (auth.id == app.owner_id)
									cv();
								else {
									// Make sure they have CREATE_VARS permission
									this.user.hasPermission(appId, auth.id, this.UserPermissions.CREATE_VARS)
										.then(() => {
											cv();
										})
										.catch(reject);
								}
							})
							.catch(reject);
					});
			})
			.catch(reject);
	});
}

// Modify value of something
module.exports.vars.modify = (appId, userId, key, value, authToken, hwid) => {
	return new Promise((resolve, reject) => {
		this.user.verifyToken(authToken, appId, hwid)
			.then(auth => {
				this.vars.get(appId, userId, key, authToken)
					.then(varExists => {
						if (varExists == null)
							return reject(this.Messages.UNKNOWN_KEY);

						this.app.info(appId)
							.then(app => {
								function mv(){
									module.exports.db.run("UPDATE vars SET value = ? WHERE key = ? AND application_id = ? AND user_id = ?", [ value, key, appId, userId ], err => {
										if (err) return reject(err);
										
										module.exports.vars.get(appId, userId, key, authToken, hwid)
											.then(resolve)
											.catch(reject);
									})
								}

								if (auth.id == app.owner_id)
									mv();
								else {
									this.user.hasPermission(appId, auth.id, this.UserPermissions.MODIFY_VARS)
										.then(mv)
										.catch(reject);
								}
							})
							.catch(reject);
					})
					.catch(reject);
			})
			.catch(reject);
	});
}

module.exports.vars.delete = (appId, userId, key, authToken, hwid) => {
	return new Promise((resolve, reject) => {
		this.user.verifyToken(authToken, appId, hwid)
			.then(auth => {
				this.vars.get(appId, userId, key, authToken, hwid)
					.then(v => {
						if (v == this.Messages.UNKNOWN_KEY)
							return reject(v);

						this.app.info(appId)
							.then(app => {
								function rk()
								{
									module.exports.db.run("DELETE FROM vars WHERE application_id = ? AND user_id = ? AND key = ?", [ appId, userId, key ], err => {
										if (err) return reject(err);
										else return resolve(module.exports.Messages.VAR_DELETED);
									})
								}

								if (app.owner_id == auth.id)
									rk()
								else{
									this.user.hasPermission(appId, auth.id, this.UserPermissions.DELETE_VARS)
										.then(rk)
										.catch(reject);
								}
							})
							.catch(reject);
					})
					.catch(reject);
			})
			.catch(reject);
	});
}

// #endregion

// #region Code for managing invites

module.exports.invite.create = (appId, userId, expiresAt, authToken, code) => {
	return new Promise((resolve, reject) => {
		// Code format
		if (!code)
			code = `${genStr(5)}-${genStr(5)}-${genStr(5)}-${genStr(5)}`.toUpperCase();
		else if (hasSpecial(code))
			return reject("Code cannot contain special characters.");
		else if (typeof(expiresAt) != "number")
			return reject("Expires must be a number.");
		else if (expiresAt <= epoch())
			return reject("Date that invite expires cannot be before now.");

		this.app.info(appId)
			.then(app => {
				if (app.private == 0)
					return reject(this.Messages.APPLICATION_PUBLIC)

				this.invite.info(code)
					.then(() => { return reject(this.Messages.FAILED_TO_CREATE_INVITE) })
					.catch(err => { 
						if (err != this.Messages.INVITE_INVALID)
							return reject(err);

						
						this.user.verifyToken(authToken, appId)
							.then(auth => {
								// Create invite
								function ci(){
									module.exports.db.run("INSERT INTO invites (application_id, owner_id, invite_code, expires) VALUES (?, ?, ?, ?)", [ appId, userId == null ? auth.id : userId, code, expiresAt ], err => {
										if (err) return reject(err);
		
										module.exports.invite.info(code)
											.then(resolve)
											.catch(reject);
									})
								}
		
								if (auth.id == app.owner_id)
									ci();
								else {
									this.user.hasPermission(appId, auth.id, this.UserPermissions.CREATE_INVITES)
										.then(ci)
										.catch(reject);
								}
							})
							.catch(reject);
					});
			})
			.catch(reject);
	});
}

// Dont care about that. Fuck that shit.
// module.exports.invite.modify = () => {}

module.exports.invite.delete = (appId, code, authToken) => {
	return new Promise((resolve, reject) => {
		// Delete invite
		function di() {
			module.exports.db.run("DELETE FROM invites WHERE invite_code = ?", [ code ], err => {
				if (err) return reject(err);

				return resolve(module.exports.Messages.INVITE_DELETED);
			})
		}

		this.app.info(appId)
			.then(app => {
				this.user.verifyToken(authToken, appId)
					.then(auth => {
						if (auth.id == app.owner_id)
							di();
						else {
							this.user.hasPermission(appId, auth.id, this.UserPermissions.DELETE_INVITES)
								.then(di)
								.catch(reject);
						}
					})
					.catch(reject);
			})
	});
}

module.exports.invite.all = (appId, userId, authToken, hwid) => {
	return new Promise((resolve, reject) => {
		this.user.verifyToken(authToken, appId, hwid)
			.then(auth => {
				function vi() {
					module.exports.db.all("SELECT * FROM invites WHERE claimed_by is null AND application_id = ? AND owner_id = ?", [ appId, userId ], (err, rows) => {
						if (err) return reject(err);

						return resolve(rows);
					});
				}

				if (auth.id == userId)
					vi();
				else {
					this.user.hasPermission(appId, auth.id, this.UserPermissions.ADMIN)
						.then(() => {
							vi();
						})
						.catch(reject);
				}
			})
			.catch(reject);
	});
}

module.exports.invite.info = (code) => {
	return new Promise((resolve, reject) => {
		this.db.get("SELECT * FROM invites WHERE invite_code = ?", [ code ], (err, data) => {
			if (err) return reject(err);
			else if (!data) return reject(this.Messages.INVITE_INVALID)
			else {
				if (data.claimed_by) return reject(this.Messages.INVITE_CLAIMED);
				else if (epoch() > data.expires && data.expires != 0) return reject(this.Messages.INVITE_EXPIRED);
			}

			return resolve(data);
		})
	})
}

// #endregion

// #region Code for managing files

module.exports.files.create = (appId, userId, fileName, content, private, authToken, hwid) => {
	return new Promise((resolve, reject) => {
		if (typeof(private) != "boolean")
			return reject("Private must be of type boolean.");
		else if (fs.existsSync(`${__dirname}/uploads/${appId}/${fileName}`))
			return reject(this.Messages.FILE_EXISTS);

		this.user.verifyToken(authToken, appId, hwid)
			.then(auth => {
				this.user.hasPermission(appId, auth.id, this.UserPermissions.UPLOAD_FILES)
					.then(() => {
						this.files.get(appId, userId, fileName, authToken)
							.then(() => { return reject(this.Messages.FILE_EXISTS) })
							.catch(erMsg => {
								if (erMsg != this.Messages.UNKNOWN_FILE)
									return reject(erMsg);
		
								this.db.run("INSERT INTO files (application_id, user_id, file, private) VALUES (?, ?, ?, ?)", [ appId, userId, fileName, private ? 1 : 0 ], err => {
									if (err) return reject(err);
		
									// If its a user file and the dir doesn't exist, create it
									if (userId != -1 && !fs.existsSync(`${__dirname}/uploads/${appId}/${userId}`))
										fs.mkdirSync(`${__dirname}/uploads/${appId}/${userId}`);

									fs.writeFileSync(`${__dirname}/uploads/${appId}/${(userId == -1 ? fileName : `${userId}/${fileName}`)}`, content);

									this.files.get(appId, userId, fileName, authToken, false)
										.then(resolve)
										.catch(reject);
								})
							});
					})
					.catch(reject);
			})
			.catch(reject);
	})
}

module.exports.files.delete = (appId, userId, fileName, authToken, hwid) => {
return new Promise((resolve, reject) => {
	 this.user.verifyToken(authToken, appId, hwid)
		.then(auth => {
			this.user.hasPermission(appId, auth.id, this.UserPermissions.DELETE_FILES)
				.then(() => {
					if (!fs.existsSync(`${__dirname}/uploads/${appId}/${fileName}`))
						return reject(this.Messages.FILE_DOESNT_EXIST);

					this.db.run("DELETE FROM files WHERE application_id = ? AND user_id = ? AND file = ?", [ appId, userId, fileName ], err => {
						if (err) return reject(err);
						
						fs.unlinkSync(`${__dirname}/uploads/${appId}/${(userId == -1 ? fileName : `${userId}/${fileName}`)}`);
						return resolve(this.Messages.FILE_DELETED)
					});
				})
				.catch(reject);
		})
		.catch(reject);
 })
}

module.exports.files.get = (appId, userId, fileName, authToken, hwid, readFile = true) => {
	return new Promise((resolve, reject) => {
		if (typeof(readFile) != "boolean")
			return reject("Read file must be of type boolean.");

		this.db.get("SELECT * FROM files WHERE application_id = ? AND user_id = ? AND file = ?", [ appId, userId, fileName ], (err, data) => {
			if (err) return reject(err);
			else if (!data) return reject(this.Messages.UNKNOWN_FILE);
			else if (data.private == 1 && !authToken) return reject(this.Messages.MISSING_AUTH_KEY);
			else if (data.private == 0) {
				if (readFile)
					return resolve(fs.readFileSync(`${__dirname}/uploads/${appId}/${data.file}`))
				else
					return resolve(data);
			}
			else if (!fs.existsSync(`${__dirname}/uploads/${appId}/${data.file}`)){
				this.db.run("DELETE FROM files WHERE application_id = ? AND user_id = ? AND file = ?", [ appId, userId, fileName ], err => {
					if (err) return reject(err);
					else return reject(this.Messages.UNKNOWN_FILE);
				});
			}
			else {
				this.user.verifyToken(authToken, appId, hwid)
					.then(auth => {
						this.app.info(appId)
							.then(app => {
								function get(){
									if (readFile)
										return resolve(fs.readFileSync(`${__dirname}/uploads/${appId}/${data.file}`))
									else
										return resolve(data);
								}
					
								if (app.owner_id == auth.id)
									get();
								else {
									this.user.hasPermission(appId, auth.id, this.UserPermissions.VIEW_PRIVATE_VARS)
										.then(() => {
											get();
										})
										.catch(reject);
								}
							})
							.catch(reject);
					})
					.catch(reject);
			}
		});
	});
}

// #endregion

// #region Code for subcriptions

// Get information on a subscription
module.exports.subscriptions.info = (appId, userId, authToken, hwid) => {
	return new Promise((resolve, reject) => {
		this.user.verifyToken(authToken, appId, hwid)
			.then(() => {
				this.db.get("SELECT * FROM subscriptions WHERE application_id = ? AND user_id = ?", [ appId, userId ], (err, row) => {
					if (err) return reject(err);
					else if (!row) return reject(this.Messages.UNKNOWN_SUBSCRIPTION);
					else if (row.subscription_expires < epoch() && row.subscription_expires != 0) return reject(this.Messages.SUBSCRIPTION_EXPIRED)
					
					return resolve(row);
				})
			})
			.catch(reject);
	});
}

// Create a subscription
module.exports.subscriptions.create = (appId, userId, expiresAt, authToken, hwid) => {
	return new Promise((resolve, reject) => {
		if (typeof(expiresAt) != 'number')
			return reject("expiresAt must be type of number");

		// Make sure theres not already a subscription
		this.subscriptions.info(appId, userId, authToken, hwid)
			.then(() => {
				return reject(this.Messages.ALREADY_SUBSCRIBED);
			})
			.catch(() => {
				this.user.verifyToken(authToken, appId, hwid)
					.then(auth => {
						this.app.info(appId)
						.then(app => {
								this.user.info(userId, appId) 
									.then(() => { // Literally just check and make sure the user exists
										if (app.subscriptions_enabled == 0)
											return reject(this.Messages.SUBSCRIPTIONS_DISABLED);
										
										this.user.hasPermission(appId, auth.id, this.UserPermissions.CREATE_SUBSCRIPTION)
											.then(() => {
												this.db.run("INSERT INTO subscriptions (application_id, user_id, subscription_expires) VALUES (?, ?, ?)", [ appId, userId, expiresAt ], err => {
													if (err) return reject(err);
				
													this.subscriptions.info(appId, userId, authToken, hwid)
														.then(resolve)
														.catch(reject);
												})
											})
											.catch(reject);
									})
									.catch(reject);
							})
							.catch(reject);
					})
					.catch(reject);
			})
	})
}

// Modify a subscription
module.exports.subscriptions.modify = (appId, userId, changes, authToken, hwid) => {
	return new Promise((resolve, reject) => {
		this.user.verifyToken(authToken, appId, hwid) 
			.then(auth => {
				this.user.hasPermission(appId, auth.id, this.UserPermissions.MODIFY_SUBSCRIPTION)
					.then(() => {
						this.subscriptions.info(appId, userId, authToken, hwid)
							.then(sub => {
								modify(sub, changes, [], [], auth)
									.then(mod => {
										if (mod.changesArr.length == 0)
											this.subscriptions.info(appId, userId, authToken, hwid)
												.then(resolve)
												.catch(reject);

										// This actually updates the values
										for (var x = 0;x < mod.changesArr.length;x++)
										{
											this.db.run(`UPDATE subscriptions SET ${mod.changesArr[x][0]} = ? WHERE application_id = ? AND user_id = ?`, [ mod.changesArr[x][1], appId, userId ], err => {
												if (err)
													return reject(err);

												this.subscriptions.info(appId, userId, authToken, hwid)
													.then(resolve)
													.catch(reject);
											});
										}
									})
									.catch(reject);
							})
							.catch(reject);
					})
					.catch(reject);
			})
			.catch(reject);
	});
}

// Delete a subscription
module.exports.subscriptions.delete = (appId, userId, authToken, hwid) => {
	return new Promise((resolve, reject) => {
		this.user.verifyToken(authToken, appId, hwid)
			.then(auth => {
				this.subscriptions.info(appId, userId, authToken, hwid)
					.then(() => { 
						function ds(){
							module.exports.db.run("DELETE FROM subscriptions WHERE application_id = ? AND user_id = ?", [ appId, userId ], err => {
								if (err) return reject(err);
		
								return resolve(module.exports.Messages.SUBSCRIPTION_DELETED)
							})
						}
		
						if (auth.id == userId)
							ds();
						else {
							this.user.hasPermission(appId, auth.id, this.UserPermissions.DELETE_SUBSCRIPTION)
								.then(() => {
									ds();
								})
								.catch(reject);
						}
					})
					.catch(reject)
			})
			.catch(reject);
	});
}

// #endregion

// #region Past here is a cesspool of code I did long ago and wish it was longer ago. This code sucks massive horse cock.

// I don't intend for this to be an endpoint, more like a manual call and fix.
module.exports.app.recalculateAllUserTokens = (appId, authToken, hwid) => {
	return new Promise((resolve, reject) => {
		this.user.verifyToken(authToken, appId, hwid)
			.then(auth => {
				this.user.hasPermission(appId, auth.id, this.UserPermissions.MODIFY_USERS)
					.then(() => {
						this.db.all("SELECT id FROM users WHERE application_id = ?", [ appId ], (err, users) => {
							if (err) return reject(err);
							else if (!users) return resolve("Recalculated no tokens (no users)");
							
							for (var x in users){
								this.user.recalculateToken(users[x].id)
									.then(() => { console.log(`Recalculated token for user ID ${users[x].id}`); })
									.catch(console.error); // Don't stop recalculating all tokens, just print the error
							}

							resolve(`Recalulated ${users.length} token(s)`);
						});
					})
					.catch(reject);
			})
			.catch(reject);
	});
}

// This is how we currently calculate tokens. I never want to have to read this code ever again. This code fucking sucks.
// I wrote this before I learned about JWTs. I am way too lazy to move over to that for now, so here we have some code that makes me sad.
// This code is fucking pathetic.
module.exports.user.calculateToken = (username, passwordHash) => {
	return new Promise((resolve, reject) => {
		var token;
	
		// Username to lowercase
		username = username.toLowerCase();

		fs.appendFileSync("logs/token-generation.log", `Started with the following data:`);
		fs.appendFileSync("logs/token-generation.log", ` > Username: ${username}`);
		fs.appendFileSync("logs/token-generation.log", ` > Password: ${passwordHash}`);
	
		var mixed_username_password = [];
		var iterations = { "username": 0, "password": 0 };
		var totalLen = passwordHash.length + username.length;
		var multiplier = 1;
		var total = 0;
		var nextIndex = 0;
	
		fs.appendFileSync("logs/token-generation.log", "Shuffling array...");
	
		// loop through
		for (var x = 0;x < totalLen;x++)
		{
			if ((x % 2 == 0 || !passwordHash[iterations.password]) && username[iterations.username])
			{
				mixed_username_password.splice(nextIndex, 0, username[iterations.username]);
	
				fs.appendFileSync("logs/token-generation.log", `Added (username): (Index ${nextIndex}) ${username[iterations.username]}`);
				iterations.username++;
			}
			else
			{
				mixed_username_password.splice(nextIndex, 0, passwordHash[iterations.password]);
				
				fs.appendFileSync("logs/token-generation.log", `Added (password): (Index ${nextIndex}) ${passwordHash[iterations.password]}`);
				iterations.password++;
			}
	
			multiplier = (x % 2 == 0 ? multiplier / iterations.username : multiplier * iterations.username);
			total  = (multiplier * iterations.username/mixed_username_password.length) * 10;
			nextIndex = Math.floor(total < 1 ? total * 10 : total);
		}
	
		fs.appendFileSync("logs/token-generation.log", "Verifying array...");
	
		if (mixed_username_password.length != totalLen)
			return reject("Verification failure: array lengths differ.");
	
		// reset this array
		iterations.username = 0;
		iterations.password = 0;
	
	
		var tempArr = mixed_username_password.slice();
		for (x = 0;x < mixed_username_password.length;x++)
		{
			if (tempArr.includes(username[iterations.username]))
			{
				for (var y = 0;y < tempArr.length;y++)
				{
					if (tempArr[y] == username[iterations.username])
					{
						tempArr.splice(y, 1);
						break;
					}
				}
	
				fs.appendFileSync("logs/token-generation.log", `[Username] Removing element ${username[iterations.username]}`);
				iterations.username++;
			} else if (tempArr.includes(passwordHash[iterations.password]))
			{
				for (var y = 0;y < tempArr.length;y++)
				{
					if (tempArr[y] == passwordHash[iterations.password])
					{
						tempArr.splice(y, 1);
						break;
					}
				}
	
				fs.appendFileSync("logs/token-generation.log", `[Password] Removing element ${passwordHash[iterations.password]}`);
				iterations.password++;
			}
		}
	
		if (tempArr.length != 0)
			return reject("Verification failure: missing or forgetting characters");
	
		fs.appendFileSync("logs/token-generation.log", "Verifiation success: token was verified.");
	
		fs.appendFileSync("logs/token-generation.log", "Adjusting array using caesar ciper...");
	
		// shift array using caesar cipher
		var shifted_array = [];
		for (x = 0;x < mixed_username_password.length;x++)
		{
			let shift_amount = 0;
	
			let char_array = "abcdefghijklmnopqrstuvwxyz";
			if (char_array.includes(mixed_username_password[x]))
			{
				for (var y = 0;y < char_array.length;y++)
				{
					if (mixed_username_password[x] == char_array[y])
					{
						shift_amount = Math.floor(((x * y) * 3) % mixed_username_password.length);
	
						if (isNaN(shift_amount))
							shift_amount = 1;
	
						fs.appendFileSync("logs/token-generation.log", `Shifting at index ${x} to ${shift_amount} characters`);
	
						shifted_array.push(this.shiftString(mixed_username_password[x], shift_amount));
					}
				}
			} else
				shifted_array.push(mixed_username_password[x]);
		}
	
		fs.appendFileSync("logs/token-generation.log", `Raw mixed data: ${mixed_username_password.join('')}`)
		fs.appendFileSync("logs/token-generation.log", `Raw shifted data: ${shifted_array.join('')}`)
	
		// acutal token
		token = this.hashString(shifted_array.join(''));
	
		fs.appendFileSync("logs/token-generation.log", `Acual token: ${token}`);
	
		return resolve(token);
	});
}

// Hash a string. Not that hard if you really think about it.
module.exports.hashString = (str) => {
	// Why?
	if (!str) return;

	// Return a hash (SHA256)
	return crypto.createHash("sha256").update(str).digest("hex");
}

// Ceaser cipher shifting.
// Another funciton I never want to revisit. There is a reason why these are at the bottom of the document.
// Organization? No. Fuck that. I just don't want to read this shit.
module.exports.shiftString = (str, amount) => {
	if (amount < 0)
		amount = -amount;

	let char_array = "abcdefghijklmnopqrstuvwxyz";

	var new_str = "";

	for (var x = 0;x < str.length;x++)
	{
		var found = false;
		if (char_array.includes(str[x].toLowerCase()))
		{
			let uppercase = false;

			// uppercase
			if (str[x] == str[x].toUpperCase())
				uppercase = true;

			for (var y = 0;y < char_array.length;y++)
			{
				if (char_array[y] == str[x].toLowerCase())
				{
					if ((y + amount) < 26)
						if (uppercase)
						{
							new_str += char_array[y + amount].toUpperCase();
							break;
						}
						else
						{
							new_str += char_array[y + amount];
							break;
						}
					else
					{
						let z = 0;
						for (z = (y + amount);z >= 26;z -= 26) { }

						if (uppercase)
						{
							new_str += char_array[z].toUpperCase();
							break;
						}
						else
						{
							new_str += char_array[z];
							break;
						}
					}
				}
			}
		} else
			new_str += str[x];
	}

	return new_str;
}

// #endregion
