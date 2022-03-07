import { App } from "./App";
import { User } from "./User";
import { SubscriptionLevel } from "./SubscriptionLevel";
import { ISubscription } from "./interfaces/ISubscription";
import { FLAGS } from './UserPermissions';
import { Utils } from '../utils/Utils';
import { Core } from '..';

export class Subscription implements ISubscription {
  // IBase fields
  id: number;
  disabled: boolean;
  disableReason?: string;

  // ISubscription fields
  application: App;
  user: User;
  level: SubscriptionLevel;
  expiresAt?: Date;

  /**
   * Create a new subscription for a user
   * @param auth 
   * @param app 
   * @param user 
   * @param subscriptionLevel 
   * @param expiresAt 
   * @param overwrite Should we overwrite a previous subscription on the user (if it exists, and application only allows one subscription at a time)
   * @returns
   */
  static create(auth: User, app: App, user: User, subscriptionLevel: SubscriptionLevel, expiresAt: Date, overwrite?: boolean): Promise<Subscription> {
    return new Promise<Subscription>(async (resolve, reject) => {
      if (!auth?.permissions.has(FLAGS.CREATE_SUBSCRIPTION))
        return reject('Invalid permissions');

      let prev = await Subscription.get(auth, app, user)
        .catch(() => {});

      if (prev && !overwrite && !app.multipleSubscriptions)
        return reject('There is already a subscription active.');

      Core.db.serialize(() => {
        if (!app.multipleSubscriptions)
          Core.db.run('DELETE FROM subscriptions WHERE application_id = ? AND user_id = ?', [ app.id, user.id ]);
        else
          Core.db.run('DELETE FROM subscriptions WHERE application_id = ? AND user_id = ? AND level_id = ?', [ app.id, user.id, subscriptionLevel.id ]);
        
        Core.db.get('SELECT * FROM subscriptions WHERE application_id = ? ORDER BY id DESC', [ app.id ], (err, data) => {
          if (err)
            return reject(err);

          let id = (data?.id || 0) + 1;

          Core.db.run('INSERT INTO subscriptions (id, application_id, user_id, level_id, expires_at) VALUES (?, ?, ?, ?, ?)', [ id, app.id, user.id, subscriptionLevel.id, expiresAt.getTime() ], async err => {
            if (err)
              return reject(err);

            return resolve(await Subscription.get(auth, app, user));
          })
        })
      })
    })
  }

  static get(auth: User | null, app: App, user: User): Promise<Subscription> {
    return new Promise<Subscription>((resolve, reject) => {
      if (auth?.id != user?.id && !auth?.permissions.has(FLAGS.VIEW_SUBSCRIPTION))
        return reject('Invalid permissions');

      Core.db.get('SELECT * FROM subscriptions WHERE application_id = ? AND user_id = ?', [ app.id, user.id ], (err, data) => {
        // Reject errors
        if (err)
          return reject(err);

        // If there is data, the subscriptions are NOT public, and the requesting user is not the same as the target user, reject.
        else if (data && !auth?.application.publicSubscriptions && data.user_id != auth?.id && !auth?.permissions.has(FLAGS.VIEW_SUBSCRIPTION))
          return reject('Subscriptions are not public on this application')

        // No data.
        else if (!data)
          return reject('User does not have a subscription');

        // Return the data
        else
          return resolve(Subscription.fill(auth, data));
      })
    })
  }

  static fill(auth: User, data: any): Promise<Subscription> {
    return new Promise<Subscription>(async (resolve, reject) => {
      var sub = new Subscription();
  
      sub.id = data.id;
      sub.disabled = data.disabled == 1 ? true : false;
      sub.disableReason = data.disable_reason;
      sub.application = await App.get(data.application_id);
      sub.user = await User.get(data.user_id);
      sub.level = await SubscriptionLevel.get(auth, sub.application, data.level_id);
      sub.expiresAt = await new Date(data.expires_at * 1000);

      return resolve(sub);
    })
  }
}