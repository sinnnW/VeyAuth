import { App } from '../App';
import { User } from '../User';
import { IBase } from './IBase';

export interface ISubscriptionLevel extends IBase {
  application: App;
  name: string;
  description?: string;
}