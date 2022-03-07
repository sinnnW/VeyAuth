import { Subscription } from './Subscription';
import { SubscriptionLevel } from './SubscriptionLevel';
import { App } from './App';
import { User } from './User';
import { ISubscriptionManager } from './interfaces/ISubscriptionManager';
import { FLAGS } from './UserPermissions';
import { Core } from '..';

export class SubscriptionManager implements ISubscriptionManager {
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

  getSubscription(app?: App, user?: User): Promise<Subscription> {
    return new Promise<Subscription>((resolve, reject) => {
      if (this.#auth?.id != user?.id && !this.#auth?.permissions.has(FLAGS.VIEW_SUBSCRIPTION))
        return reject('Invalid permissions');

      if (!app && !user) {
        Core.db.get('SELECT * FROM subscriptions WHERE application_id = ? AND user_id = ?', [ this.#auth?.application.id, this.#auth?.id ], (err, data) => {
          // Reject errors
          if (err)
            return reject(err);

          // If there is data, the subscriptions are NOT public, and the requesting user is not the same as the target user, reject.
          else if (data && !this.#auth?.application.publicSubscriptions && data.user_id != this.#auth?.id)
            return reject('Subscriptions are not public on this application')

          // No data.
          else if (!data)
            return reject('User does not have a subscription');

          // Return the data
          else
            return resolve(Subscription.fill(data));
        })
      }
    })
  }

  getSubscriptionLevel(name?: string): Promise<SubscriptionLevel> {
    return new Promise<SubscriptionLevel>((resolve, reject) => {

    })
  }
}