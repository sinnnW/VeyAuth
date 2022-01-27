import { IUser } from '../types/interfaces/IUser';
import { encode, decode, TAlgorithm } from 'jwt-simple';

const alg: TAlgorithm = 'HS512';
export function encodeUser(user: IUser, secret: string) {
    return encode(user, secret, alg);
}

export function decodeUser(token: string, secret: string) {
    return decode(token, secret, false, alg);
}