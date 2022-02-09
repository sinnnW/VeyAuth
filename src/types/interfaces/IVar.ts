import { Var } from '../Var';
import { App } from '../App';
import { User } from '../User';

export interface IVar {
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
}