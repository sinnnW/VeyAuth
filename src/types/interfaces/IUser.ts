import { IBase } from './IBase';
import { UserPermissionsArray } from '../UserPermissionsArray';
import { App } from '../App';
import { User } from '../User';

export interface IUser extends IBase {
    authenticated: boolean;
    application: App;
    username: string;
    password: string;
    token: string;
    hwid?: string;
    permissions: UserPermissionsArray;//[appId: number, permissions: UserPermissions];
    format: string;

    recalculateToken(auth: User): Promise<string>;
    setDisabled(disabled: boolean): void;
    enable(): void;
    disable(): void;
    setUsername(username: string): void;
    setPassword(password: string): void;
    setHwid(hwid: string): void;
    save(auth: User): Promise<User>;
    delete(): Promise<void>;
}