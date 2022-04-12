import { IInviteManager } from './interfaces/IInviteManager';
import { Invite } from './Invite';
import { User } from './User'

export class InviteManager implements IInviteManager {
  created: Invite[];
  claimed: Invite | null;

  #auth: User;

  constructor(auth: User) {
    this.#auth = auth;
  }

  _getData(): Promise<void> {
    return new Promise(async (resolve, _) => {
      this.created = await Invite.getAll(this.#auth);
      this.claimed = await Invite.getClaimed(this.#auth);

      resolve();
    })
  }

  create(expiresAt?: Date, auth?: User): Promise<Invite> {
    return new Promise(async (resolve, _) => {
      let i = await Invite.create(auth || this.#auth, this.#auth.application, this.#auth, expiresAt || new Date(0));
      
      // Refresh data
      await this._getData();
      return resolve(i);
    })
  }

  delete(code: string): Promise<void> {
    return new Promise(async (resolve, _) => {
      let i = Invite.delete(this.#auth, this.#auth.application, code);
      
      // Refresh data
      await this._getData();
      return resolve(i);
    })
  }
}