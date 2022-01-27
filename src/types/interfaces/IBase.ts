import { Database } from 'sqlite3';

export interface IBase {
    id: number;
    disabled: boolean;
    disableReason?: string;
}