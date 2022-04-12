import { Invite } from '../Invite';
import { User } from '../User';

export interface IInviteManager {
  created: Invite[];
  claimed: Invite | null;

  _getData(): Promise<void>;
  create(expiresAt?: Date, auth?: User): Promise<Invite>;
  delete(code: string): void;
}