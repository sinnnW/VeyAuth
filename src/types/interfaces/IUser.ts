import { IBase } from './IBase';
import { UserPermissions } from '../UserPermissions';

export interface IUser extends IBase {
    applicationId: number;
    username: string;
    password: string;
    token: string;
    hwid?: string;
    permissions: [appId: number, permissions: UserPermissions];
}