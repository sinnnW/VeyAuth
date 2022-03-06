import { Subscription } from './Subscription';
import { SubscriptionLevel } from './SubscriptionLevel';
import { App } from './App';
import { User } from './User';
import { ISubscriptionManager } from './interfaces/ISubscriptionManager';

export class SubscriptionManager implements ISubscriptionManager {
  getSubscription(): Promise<Subscription> {
    return new Promise<Subscription>((resolve, reject) => {

    })
  }

  getSubscriptionLevel(): Promise<SubscriptionLevel> {
    return new Promise<SubscriptionLevel>((resolve, reject) => {
      
    })
  }
}