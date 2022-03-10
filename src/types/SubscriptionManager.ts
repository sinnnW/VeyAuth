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
  
  /**
   * Create a new subscription
   */
  subscribe = Subscription.create;

  /**
   * Remove a subscription
   * @param subscription 
   * @returns {Promise<void>}
   */
  unsubscribe(auth: User, subscription?: Subscription): Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (this.#auth.application.multipleSubscriptions) {
        if (!subscription)
          return reject('On applications with multiple subscriptions, you must supply the subscription to remove');
      } else
        subscription = this.#auth.subscription.subscriptions as Subscription;

      return await Subscription.remove(auth, this.#auth.application, subscription);
    })
  }
  
  // getLevel(): Promise<SubscriptionLevel> {
  //   return SubscriptionLevel.get()
  // }
  // getSubscriptionLevel = SubscriptionLevel.getById;

  // getSubscription(app?: App, user?: User): Promise<Subscription> {
    
  // }

  // getSubscriptionLevel(name?: string): Promise<SubscriptionLevel> {

  // }
}