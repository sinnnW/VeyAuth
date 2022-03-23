import { IBase } from './IBase';
import { User } from '../User';
import { App } from '../App'

export interface IApp extends IBase {
  name: string;
  description: string;
  owner: User;
  allowUserSelfDeletion: boolean;
  publicSubscriptions: boolean;
  multipleSubscriptions: boolean;
  format: string;

  setDisabled(disabled: boolean): void;
  enable(): void;
  disable(): void;
  setDisableReason(reason: string): void;
  setName(title: string): void;
  setDescription(description: string): void;
  setOwner(newOwner: User): void;
  save(auth: User): Promise<App>;
  remove(auth: User): Promise<void>;
  getUserCount(): Promise<number>;
}