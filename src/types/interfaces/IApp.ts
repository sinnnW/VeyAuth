import { IBase } from './IBase';
import { IVar } from './IVar';
import { User } from '../User';

export interface IApp extends IBase {
    name: string;
    description: string;

    getUserCount(): number;
    getVars(authToken: string, hwid: string): [vars: IVar];
    setTitle(title: string): void;
    setDescription(description: string): void;

    // static create(name: string, auth: User)
}