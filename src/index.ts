import { Database } from 'sqlite3';
import { createLogger, Logger, LoggerOptions } from 'winston';
import { Utils } from './utils/Utils';
import { config } from 'dotenv';
import fs from 'fs';

export class Core {
  static db: Database;
  static logger: Logger;

  constructor(loggerOpts: LoggerOptions) {
    Core.logger = createLogger(loggerOpts);
    Core.logger.info('Starting VeyCore by verlox...');
    Core.db = new Database(`${__dirname}/auth.db`);

    // Load .env vars
    config();

    //#region Setup database
    Core.logger.info('Setting up tables and data...');
    Core.db.serialize(() => {
      // Applications table
      Core.db.run('CREATE TABLE IF NOT EXISTS "applications" ( "id" INTEGER, "owner_id" INTEGER, "name" TEXT, "description" TEXT, "disabled" INTEGER NOT NULL DEFAULT 0, "disable_reason" TEXT, "subscriptions_enabled" INTEGER NOT NULL DEFAULT 0, "invite_required" INTEGER NOT NULL DEFAULT 0, "hwid_locked" INTEGER NOT NULL DEFAULT 0, "allow_user_self_deletion" INTEGER NOT NULL DEFAULT 1, PRIMARY KEY("id"))');

      // User table
      Core.db.run('CREATE TABLE IF NOT EXISTS "users" ( "id" INTEGER, "application_id" INTEGER, "username" INTEGER, "password" TEXT, "token" TEXT NOT NULL, "disabled" INTEGER NOT NULL DEFAULT 0, "disable_reason" TEXT, "hwid" TEXT, PRIMARY KEY("application_id","id"))');

      // Permissions table
      Core.db.run('CREATE TABLE IF NOT EXISTS "permissions" ("application_id" INTEGER NOT NULL, "user_id" INTEGER NOT NULL, "permissions" INTEGER, PRIMARY KEY("application_id","user_id"))');

      // Create a application named Global, this is the global permissions
      Core.db.run('INSERT OR IGNORE INTO applications (id, name) VALUES (-1, "Global")');
    });
    //#endregion

    // Check all the environmental vars, if they don't exist, create them
    // - verlox @ 1/28/22
    Core.logger.info('Checking environment...');

    // Check for SESSION_SECRET, this is for the JWTs
    if (!process.env.SESSION_SECRET) {
      process.env.SESSION_SECRET = Utils.createString(20, true, true, false);
      fs.appendFileSync('.env', `\nSESSION_SECRET=${process.env.SESSION_SECRET}`);

      Core.logger.info(`[ENV] Created SESSION_SECRET in .env: ${process.env.SESSION_SECRET}`);
    } else
      Core.logger.info(`[ENV] SESSION_SECRET is ${process.env.SESSION_SECRET}`);

    // Check for PASSWORD_SALT, this is used in the hashString function in SecurityHelper
    if (!process.env.PASSWORD_SALT) {
      process.env.PASSWORD_SALT = Utils.createString(50, true, true, true);
      fs.appendFileSync('.env', `\nPASSWORD_SALT=${process.env.PASSWORD_SALT}`);

      Core.logger.info(`[ENV] Created PASSWORD_SALT in .env: ${process.env.PASSWORD_SALT}`);
    } else
      Core.logger.info(`[ENV] PASSWORD_SALT is ${process.env.PASSWORD_SALT}`);

    // Finished loading this shitshow
    Core.logger.info('Finished loading VeyCore!');
  }
}

// Other modules export last, since database needs to be initialized
export { App } from './types/App';
export { User } from './types/User';
export { Var } from './types/Var';