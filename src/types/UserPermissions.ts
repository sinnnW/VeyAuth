import { BitField } from '../utils/BitField';

export enum FLAGS {
  USER = 0,
  ADMIN = 1,
  CREATE_APPLICATION = 2,

  // User specific permissions
  CREATE_USERS = 4,
  DELETE_USERS = 8,
  MODIFY_USERS = 16,

  // Var specific permission
  CREATE_VARS = 32,
  DELETE_VARS = 64,
  MODIFY_VARS = 128,
  VIEW_PRIVATE_VARS = 256,

  // Invite specific permissions
  CREATE_INVITES = 512,
  DELETE_INVITES = 1024,
  MODIFY_INVITES = 2048,

  // File specific permissions
  UPLOAD_FILES = 4096,
  DELETE_FILES = 8192,
  MODIFY_FILES = 16384,
  VIEW_PRIVATE_FILES = 32768,

  BYPASS_HWID_CHECK = 65536,

  // Subscription based permissions
  VIEW_SUBSCRIPTION = 131072,
  CREATE_SUBSCRIPTION =262144,
  DELETE_SUBSCRIPTION = 524288,
  MODIFY_SUBSCRIPTION = 1048576,

  // Subscription level Permissions
  CREATE_SUBSCRIPTION_LEVEL = 2097152,
  DELETE_SUBSCRIPTION_LEVEL = 4194304,
  MODIFY_SUBSCRIPTION_LEVEL = 8388608
}

export class UserPermissions extends BitField {
  // FLAGS are subset of UserPermissions
  static FLAGS = FLAGS;

  constructor(permissions: number) {
    super(FLAGS, permissions, [FLAGS.ADMIN]);
  }

  // WTF? this is the type of code that you find and never know the purpose of because it was recoded 10 times over
  // get(): number {
  //   return this.field;
  // }
}