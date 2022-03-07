import { Subscription } from './Subscription';
import { SubscriptionLevel } from './SubscriptionLevel';
import { App } from './App';
import { User } from './User';
import { ISubscriptionManager } from './interfaces/ISubscriptionManager';
import { FLAGS } from './UserPermissions';
import { Core } from '..';

export class SubscriptionManager implements ISubscriptionManager {
  subscriptions: [Subscription] | Subscription | null;

  // This is a completely hidden variable that is used internally only.
  #auth: User;

  /**
   * Setup the subscription manager
   * @param auth 
   */
  constructor(auth: User) {
    // Set the parent
    this.#auth = auth;

    
  }

  _getSubData(): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      var data = await Subscription.get(this.#auth, this.#auth.application, this.#auth)
        .catch(() => {
          this.subscriptions = null;
        })
    
      // console.log(data)
      this.subscriptions = data as [Subscription] | Subscription;

      return resolve();
    })
  }
  
  // Aliasing
  subscribe = Subscription.create;
  
  // getLevel(): Promise<SubscriptionLevel> {
  //   return SubscriptionLevel.get()
  // }
  // getSubscriptionLevel = SubscriptionLevel.getById;

  // getSubscription(app?: App, user?: User): Promise<Subscription> {
    
  // }

  // getSubscriptionLevel(name?: string): Promise<SubscriptionLevel> {

  // }
}