import { IBase } from './IBase';
import { IVar } from './IVar';
import { User } from '../User';

export interface IApp extends IBase {
    name: string;
    description: string;
    owner: User;

    setDisabled(disabled: boolean): void;
    enable(): void;
    disable(): void;
    setName(title: string): void;
    setDescription(description: string): void;
    getUserCount(): Promise<number>;
    getVars(authToken: string, hwid: string): [vars: IVar];

    // static create(name: string, auth: User)
}