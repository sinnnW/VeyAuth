import { IBase } from './IBase';
import { User } from '../User'; 

export interface IFile extends IBase {
  format: string;
  data: string;

  rename(name: string): void;
  setPrivate(priv: boolean): void;
  setDisabled(disabled: boolean): void;
  enable(): void;
  disable(): void;
  setDisableReason(reason: string): void;
  save(auth: User): Promise<IFile>;
  delete(auth: User): Promise<void>;
}