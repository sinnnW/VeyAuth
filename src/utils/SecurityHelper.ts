import { User } from '../types/User';
import { encode, decode, TAlgorithm } from 'jwt-simple';
import { createHmac } from 'crypto';

const alg: TAlgorithm = 'HS512';
export class SecurityHelper {
  static encodeUser(user: User): string {
    var toEncode = { username: user.username, password: user.password };
    return encode(toEncode, process.env.SESSION_SECRET || '', alg);
  }

  static decodeUser(token: string): string {
    return decode(token, process.env.SESSION_SECRET || '', false, alg);
  }

  static hashString(input: string): string {
    return createHmac('sha256', process.env.PASSWORD_SALT || '').update(input).digest('hex');
  }
}