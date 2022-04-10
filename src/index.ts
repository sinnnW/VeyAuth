import { Database } from 'sqlite3';
import { createLogger, Logger, LoggerOptions } from 'winston';
import { Utils } from './utils/Utils';
import { config } from 'dotenv';
import { join } from 'path';
import { genSaltSync } from 'bcrypt';
import fs from 'fs';

export class Core {
  static db: Database;
  static logger: Logger;
  static dataDir: string;

  constructor(loggerOpts: LoggerOptions) {
    Core.logger = createLogger(loggerOpts);
    Core.logger.info('Starting VeyAuth by verlox...');
    Core.dataDir = join(__dirname, 'data');

    // Create data dir if it does not exist
    if (!fs.existsSync(Core.dataDir))
      fs.mkdirSync(Core.dataDir);
    
    Core.logger.info(`DATA DIRECTORY: ${Core.dataDir}`);

    // Create / load database
    Core.db = new Database(join(Core.dataDir, 'auth.db'));

    // Load .env vars
    config();

    //#region Setup database
    Core.logger.info('Setting up tables and data...');
    Core.db.serialize(() => {
      // Applications table
      Core.db.run('CREATE TABLE IF NOT EXISTS "applications" ( "id" INTEGER NOT NULL, "owner_id" INTEGER, "name" TEXT, "description" TEXT, "disabled" INTEGER NOT NULL DEFAULT 0, "disable_reason" BLOB DEFAULT \'No reason\', "subscriptions_enabled" INTEGER NOT NULL DEFAULT 0, "subscriptions_public" INTEGER NOT NULL DEFAULT 1, "subscriptions_multiple" INTEGER NOT NULL DEFAULT 0, "invite_required" INTEGER NOT NULL DEFAULT 0, "hwid_locked" INTEGER NOT NULL DEFAULT 0, "allow_user_self_deletion" INTEGER NOT NULL DEFAULT 1, PRIMARY KEY("id"))');

      // User table
      Core.db.run('CREATE TABLE IF NOT EXISTS "users" ( "id" INTEGER NOT NULL, "application_id" INTEGER NOT NULL, "username" INTEGER NOT NULL, "password" TEXT NOT NULL, "token" TEXT NOT NULL, "disabled" INTEGER NOT NULL DEFAULT 0, "disable_reason" TEXT DEFAULT \'No reason\', "hwid" TEXT, PRIMARY KEY("application_id","id"))');

      // Permissions table
      Core.db.run('CREATE TABLE IF NOT EXISTS "permissions" ( "application_id" INTEGER NOT NULL, "user_id" INTEGER NOT NULL, "permissions" INTEGER NOT NULL, PRIMARY KEY("application_id","user_id"))');
      
      // Subcription levels table
      Core.db.run('CREATE TABLE IF NOT EXISTS "subscription_levels" ( "id" INTEGER NOT NULL, "application_id" INTEGER NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "disabled" INTEGER NOT NULL DEFAULT 0, "disable_reason" TEXT DEFAULT \'No reason\', PRIMARY KEY("id"))');
      
      // Subscriptions table
      Core.db.run('CREATE TABLE IF NOT EXISTS "subscriptions" ( "id" INTEGER NOT NULL, "application_id" INTEGER NOT NULL, "user_id" INTEGER NOT NULL, "level_id" INTEGER NOT NULL, "expires_at" INTEGER DEFAULT 0, "disabled" INTEGER NOT NULL DEFAULT 0, "disable_reason" TEXT DEFAULT \'No reason\', PRIMARY KEY("id","application_id"))');

      // Variable table
      Core.db.run('CREATE TABLE IF NOT EXISTS "variables" ( "application_id" INTEGER NOT NULL, "user_id" INTEGER, "key" INTEGER NOT NULL, "value" INTEGER, "private" INTEGER NOT NULL DEFAULT 1, PRIMARY KEY("application_id","user_id","user_id","key"))');

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
      process.env.PASSWORD_SALT = genSaltSync(15);
      fs.appendFileSync('.env', `\nPASSWORD_SALT=${process.env.PASSWORD_SALT}`);

      Core.logger.info(`[ENV] Created PASSWORD_SALT in .env: ${process.env.PASSWORD_SALT}`);
    } else
      Core.logger.info(`[ENV] PASSWORD_SALT is ${process.env.PASSWORD_SALT}`);

    // Finished loading this shitshow
    Core.logger.info('Finished loading VeyAuth!');
  }
}

// Other modules export last, since database needs to be initialized
export { App } from './types/App';
export { User } from './types/User';
export { Variable } from './types/Variable';
export { Subscription } from './types/Subscription';
export { SubscriptionLevel } from './types/SubscriptionLevel';
export { File } from './types/File';
export { Invite } from './types/Invite';