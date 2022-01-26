import { IBase } from './IBase';
import { IVar } from './IVar';

export interface IApp extends IBase {
    name: string;
    description: string;

    getUserCount(): number;
    getVars(authToken: string, hwid: string): [vars: IVar]
}