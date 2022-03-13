import { IBase } from './IBase';
import { IVariable } from './IVariable';
import { User } from '../User';

export interface IApp extends IBase {
  name: string;
  description: string;
  owner: User;
  allowUserSelfDeletion: boolean;
  publicSubscriptions: boolean;

  setDisabled(disabled: boolean): void;
  enable(): void;
  disable(): void;
  setName(title: string): void;
  setDescription(description: string): void;
  getUserCount(): Promise<number>;
  remove(auth: User): Promise<void>;

  // static create(name: string, auth: User)
}