import { App } from '../App';
import { User } from '../User';
import { SubscriptionLevel } from '../SubscriptionLevel';
import { IBase } from './IBase';

export interface ISubscription extends IBase {
  application: App;
  user: User;
  level: SubscriptionLevel;
  expiresAt?: Date;
}