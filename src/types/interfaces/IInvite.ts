import { App } from "../App";
import { User } from "../User";

export interface IInvite {
  code: string;
  application: App;
  createdBy: User;
  claimedBy: User | null;
  
  format: string;

  setExpiration(expires: Date): void;
  save(auth: User): Promise<IInvite>;
  delete(auth: User): Promise<void>;
}