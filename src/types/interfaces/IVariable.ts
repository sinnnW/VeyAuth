import { Variable } from '../Variable';
import { App } from '../App';
import { User } from '../User';

export interface IVariable {
  key: string;
  value: string;
  private: boolean;
  application: App;
  user?: User;

  setKey(key: string): void;
  setValue(value: string): void;
  setPrivate(priv: boolean): void;
  save(auth: User): Promise<Variable>;

  delete(auth: User): void;
}