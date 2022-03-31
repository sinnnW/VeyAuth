import { Subscription } from './Subscription';
import { SubscriptionLevel } from './SubscriptionLevel';
import { User } from './User';
import { ISubscriptionManager } from './interfaces/ISubscriptionManager';
import { Core } from '..';

export class SubscriptionManager implements ISubscriptionManager {
  all: Subscription[] | Subscription | null;

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

  _getData(): Promise<void> {
    return new Promise<void>(async (resolve, _) => {
      this.all = null;
      var data = await Subscription.get(this.#auth, this.#auth.application, this.#auth)
        .catch(() => {});
    
      // console.log(data)
      this.all = data as Subscription[] | Subscription;

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
  subscribe(auth: User, subscriptionLevel: SubscriptionLevel, expiresAt?: Date, overwrite?: boolean): Promise<Subscription> {
    return new Promise<Subscription>(async (resolve, _) => {
      var sub = await Subscription.create(auth, this.#auth.application, this.#auth, subscriptionLevel, expiresAt || new Date(0), overwrite);
      
      // Update the all cache
      await this._getData();

      return resolve(sub);
    });
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

      await Subscription.remove(auth, subscription);

      // Update the all cache
      await this._getData();

      resolve();
    })
  }
}