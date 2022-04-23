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
  static started = false;

  static start(loggerOpts: LoggerOptions = {}) {
    this.logger = createLogger(loggerOpts);
    this.logger.info('Starting VeyAuth by verlox...');

    if (this.dataDir == null)
      this.dataDir = join(__dirname, 'data');

    // Create data dir if it does not exist
    if (!fs.existsSync(Core.dataDir))
      fs.mkdirSync(Core.dataDir);
    
    this.logger.info(`Data directory: ${this.dataDir}`);

    // Create / load database
    this.db = new Database(join(this.dataDir, 'auth.db'));

    // Load .env vars
    config();

    //#region Setup database
    this.logger.info('Setting up tables and data...');
    this.db.serialize(() => {
      // Applications table
      this.db.run('CREATE TABLE IF NOT EXISTS "applications" ( "id" INTEGER NOT NULL, "owner_id" INTEGER, "name" TEXT, "description" TEXT, "disabled" INTEGER NOT NULL DEFAULT 0, "disable_reason" BLOB DEFAULT  "No reason ", "subscriptions_enabled" INTEGER NOT NULL DEFAULT 0, "subscriptions_public" INTEGER NOT NULL DEFAULT 1, "subscriptions_multiple" INTEGER NOT NULL DEFAULT 0, "invite_only" INTEGER NOT NULL DEFAULT 0, "hwid_locked" INTEGER NOT NULL DEFAULT 0, "allow_user_self_deletion" INTEGER NOT NULL DEFAULT 1, "users_can_create_files" INTEGER NOT NULL DEFAULT 0, PRIMARY KEY("id"))');

      // Files table
      this.db.run('CREATE TABLE IF NOT EXISTS "files" ( "id" INTEGER NOT NULL, "application_id" INTEGER NOT NULL, "user_id" INTEGER, "file_name" TEXT NOT NULL, "private" INTEGER NOT NULL DEFAULT 1, "disabled" INTEGER NOT NULL DEFAULT 0, "disable_reason" TEXT DEFAULT  "No reason ", PRIMARY KEY("application_id","id"))');

      // Invites table
      this.db.run('CREATE TABLE IF NOT EXISTS "invites" ( "code" TEXT NOT NULL, "application_id" INTEGER NOT NULL, "created_by" INTEGER NOT NULL, "claimed_by" INTEGER, "expires_at" INTEGER DEFAULT 0, PRIMARY KEY("application_id","code"))');

      // Permissions table
      this.db.run('CREATE TABLE IF NOT EXISTS "permissions" ( "application_id" INTEGER NOT NULL, "user_id" INTEGER NOT NULL, "permissions" INTEGER NOT NULL, PRIMARY KEY("application_id","user_id"))');

      // Subcription levels table
      this.db.run('CREATE TABLE IF NOT EXISTS "subscription_levels" ( "id" INTEGER NOT NULL, "application_id" INTEGER NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "disabled" INTEGER NOT NULL DEFAULT 0, "disable_reason" TEXT DEFAULT  "No reason ", PRIMARY KEY("id"))');
      
      // Subscriptions table
      this.db.run('CREATE TABLE IF NOT EXISTS "subscriptions" ( "id" INTEGER NOT NULL, "application_id" INTEGER NOT NULL, "user_id" INTEGER NOT NULL, "level_id" INTEGER NOT NULL, "expires_at" INTEGER DEFAULT 0, "disabled" INTEGER NOT NULL DEFAULT 0, "disable_reason" TEXT DEFAULT  "No reason ", PRIMARY KEY("id","application_id"))');

      // User table
      this.db.run('CREATE TABLE IF NOT EXISTS "users" ( "id" INTEGER NOT NULL, "application_id" INTEGER NOT NULL, "username" INTEGER NOT NULL, "password" TEXT NOT NULL, "token" TEXT NOT NULL, "disabled" INTEGER NOT NULL DEFAULT 0, "disable_reason" TEXT DEFAULT  "No reason ", "hwid" TEXT, PRIMARY KEY("application_id","id"))');

      // Variables table
      this.db.run('CREATE TABLE IF NOT EXISTS "variables" ( "application_id" INTEGER NOT NULL, "user_id" INTEGER, "key" INTEGER NOT NULL, "value" INTEGER, "private" INTEGER NOT NULL DEFAULT 1, PRIMARY KEY("application_id","user_id","user_id","key"))');
      
      // Create a application named Global, this is the global permissions
      this.db.run('REPLACE INTO applications (id, name) VALUES (-1, "SystemGlobal")');
    });
    //#endregion

    // Check all the environmental vars, if they don't exist, create them
    // - verlox @ 1/28/22
    this.logger.info('Checking environment...');

    // Check for SESSION_SECRET, this is for the JWTs
    if (!process.env.SESSION_SECRET) {
      process.env.SESSION_SECRET = Utils.createString(20, true, true, false);
      fs.appendFileSync('.env', `\nSESSION_SECRET=${process.env.SESSION_SECRET}`);

      this.logger.info(`[ENV] Created SESSION_SECRET in .env: ${process.env.SESSION_SECRET}`);
    } else
      this.logger.info(`[ENV] SESSION_SECRET is ${process.env.SESSION_SECRET}`);

    // Check for PASSWORD_SALT, this is used in the hashString function in SecurityHelper
    if (!process.env.PASSWORD_SALT) {
      process.env.PASSWORD_SALT = genSaltSync(15);
      fs.appendFileSync('.env', `\nPASSWORD_SALT=${process.env.PASSWORD_SALT}`);

      this.logger.info(`[ENV] Created PASSWORD_SALT in .env: ${process.env.PASSWORD_SALT}`);
    } else
      this.logger.info(`[ENV] PASSWORD_SALT is ${process.env.PASSWORD_SALT}`);

    // Finished loading this shitshow
    this.logger.info('Finished loading VeyAuth!');
    this.started = true;
  }
}