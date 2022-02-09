import { IBase } from './IBase';
import { Var } from '../Var';
import { App } from '../App';
import { User } from '../User';

export interface IVar extends IBase {
  key: string;
  value: string;
  private: boolean;
  application: App;
  user?: User;

  setKey(key: string): void;
  setValue(value: string): void;
  setPrivate(priv: boolean): void;
  save(auth: User): Promise<Var>;

  delete(auth: User): void;
  create(auth: User, app: App, user: User, key: string, value: string, priv: boolean): void;
}