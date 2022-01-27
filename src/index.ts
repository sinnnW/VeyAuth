import { Database } from 'sqlite3';
import fs from 'fs';
import { createLogger, Logger, LoggerOptions } from 'winston';
import { createString } from './utils/Util';
import { config } from 'dotenv';

export class Auth {
	static db: Database;
	static logger: Logger;
	sessionSecret: string;

	constructor(loggerOpts: LoggerOptions) {
		// Load .env vars
		config();

		Auth.logger = createLogger(loggerOpts);
		Auth.db = new Database(`${__dirname}/auth.db`);

		Auth.logger.info('Setting up tables...');
		
		// Applications table
		Auth.db.run('CREATE TABLE IF NOT EXISTS "applications" ("id" INTEGER,"owner_id" INTEGER,"name" TEXT,"description" TEXT,"disabled" INTEGER DEFAULT 0,"disable_reason" TEXT DEFAULT "No reason","subscriptions_enabled" INTEGER DEFAULT 0,"invite_required" INTEGER DEFAULT 0,"hwid_locked" INTEGER DEFAULT 0,PRIMARY KEY("id"));');
		// User table
		Auth.db.run('CREATE TABLE IF NOT EXISTS "users" ("id" INTEGER, "application_id" INTEGER, "username" INTEGER, "password" TEXT, "token" TEXT NOT NULL, "permissions" INTEGER NOT NULL DEFAULT 0, "disabled" INTEGER NOT NULL DEFAULT 0, "diasble_reason" TEXT DEFAULT "No reason",  PRIMARY KEY("application_id","id"));');
		// Permissions table
		Auth.db.run('CREATE TABLE IF NOT EXISTS "permissions" ("application_id" INTEGER NOT NULL, "user_id" INTEGER NOT NULL, "permissions" INTEGER NOT NULL, PRIMARY KEY("application_id","user_id"))')

		if (!process.env.SESSION_SECRET)
		{
			process.env.SESSION_SECRET = createString(20, true, true, false);
			fs.appendFileSync('.env', `\nSESSION_SECRET=${process.env.SESSION_SECRET}`);

			Auth.logger.info(`Created SESSION_SECRET in .env: ${process.env.SESSION_SECRET}`);
		} else
			Auth.logger.info(`SESSION_SECRET is ${process.env.SESSION_SECRET}`);

		Auth.logger.info('Finished loading VeyAuth!');
	}
}

// Other modules export last, since database needs to be initialized
export { App } from './types/App';
export { User } from './types/User';