import { Subscription } from '../Subscription';
import { SubscriptionLevel } from '../SubscriptionLevel';
import { User } from '../User';

export interface ISubscriptionManager {
  all:  Subscription[] | Subscription | null;

  _getData(): Promise<void>;
  subscribe(auth: User, subscriptionLevel: SubscriptionLevel, expiresAt?: Date, overwrite?: boolean): Promise<Subscription>;
  unsubscribe(auth: User, subscription?: Subscription): Promise<void>;
}