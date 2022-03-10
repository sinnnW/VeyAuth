import { Subscription } from './Subscription';
import { SubscriptionLevel } from './SubscriptionLevel';
import { App } from './App';
import { User } from './User';
import { ISubscriptionManager } from './interfaces/ISubscriptionManager';
import { FLAGS } from './UserPermissions';
import { Core } from '..';

export class SubscriptionManager implements ISubscriptionManager {
  all: [Subscription] | Subscription | null;

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
          this.all = null;
        })
    
      // console.log(data)
      this.all = data as [Subscription] | Subscription;

      return resolve();
    })
  }
  
  /**
   * Subscribe to a certain level
   * @param {User} auth 
   * @param {SubscriptionLevel} subscriptionLevel 
   * @param {Date} expiresAt 
   * @param {boolean} overwrite Should it overwrite any other subscriptions (on multi subscription applications)
   * @returns {Promise<Subscription>} Subscription created
   */
  subscribe(auth: User, subscriptionLevel: SubscriptionLevel, expiresAt: Date, overwrite?: boolean): Promise<Subscription> {
    return Subscription.create(auth, this.#auth.application, this.#auth, subscriptionLevel, expiresAt, overwrite);
  }

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
        subscription = this.#auth.subscriptions.all as Subscription;

      return await Subscription.remove(auth, this.#auth.application, subscription);
    })
  }
}