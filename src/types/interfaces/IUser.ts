import { IBase } from './IBase';
import { UserPermissionsArray } from '../UserPermissionsArray';
import { App } from '../App';

export interface IUser extends IBase {
    authenticated: boolean;
    application: App;
    username: string;
    password: string;
    token: string;
    hwid?: string;
    // permissions: UserPermissionsArray;//[appId: number, permissions: UserPermissions];
    permissions: any;
}