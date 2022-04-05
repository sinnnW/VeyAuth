import { User } from '../types/User';
import { encode, decode, TAlgorithm } from 'jwt-simple';
import { createHmac } from 'crypto';

const alg: TAlgorithm = 'HS512';
export class SecurityHelper {
  /**
   * Encode a user to a token
   * @param {User} user User
   * @returns {string} Token
   */
  static encodeUser(user: User): string {
    var toEncode = { username: user.username, password: user.password };
    return encode(toEncode, process.env.SESSION_SECRET || '', alg);
  }

  // /**
  //  * Decode a token into a user
  //  * @param {string} token Token
  //  * @returns {string} Decoded user
  //  */
  // static decodeUser(token: string): string {
  //   return decode(token, process.env.SESSION_SECRET || '', false, alg);
  // }

  /**
   * Hash and salt a string
   * @param {string} input Input string
   * @returns {string} Hashed and salted string
   */
  static hashString(input: string): string {
    return createHmac('sha256', process.env.PASSWORD_SALT || '').update(input).digest('hex');
  }
}