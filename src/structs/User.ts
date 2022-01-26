import { IBase } from "./IBase";

export interface IUser extends IBase {
    id: number;
    username: string;
    token: string;

    disabled: boolean;
    disableReason: string;
}