import { IMessage } from './interfaces/IMessage';

enum CODES {
    // User related ones
    USER_DISABLED,
    VALID_AUTH,
    INVALID_AUTH,

    // App related ones
    APP_DISABLED,
}

export class Message implements IMessage {
    static CODES = CODES;
    code: string;
    message?: string;
    extra?: any;

    constructor(code: CODES, message?: string, extra?: any) {
        this.code = code.toString();
        this.message = message;
        this.extra = extra;
    }
}