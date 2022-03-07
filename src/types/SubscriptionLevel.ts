import { App } from './App';
import { User } from './User';
import { ISubscriptionLevel } from './interfaces/ISubscriptionLevel';
import { Core } from '../index';
import { FLAGS } from './UserPermissions';

export class SubscriptionLevel implements ISubscriptionLevel {
  // IBase attributes
  id: number;
  disabled: boolean;
  disableReason?: string

  // ISubscriptionLevel attributes
  application: App;
  name: string;
  description?: string;

  static getById(auth: User | null, app: App, id: number): Promise<SubscriptionLevel> {
    return new Promise<SubscriptionLevel>((resolve, reject) => {
      Core.db.get('SELECT * FROM subscription_levels WHERE application_id = ? AND id = ?', [ app.id, id ], async (err, data) => {
        if (err)
          return reject(err);

        else if (!data)
          return reject('Unknown subscription level ID');

        var app = await App.get(data.application_id);

        if (!app.publicSubscriptions && !auth?.permissions.has(FLAGS.VIEW_SUBSCRIPTION))
          return reject('Subscriptions are private on this application');

        return resolve(await SubscriptionLevel.fill(data));
      });
    })
  }

  static fill(data: any): Promise<SubscriptionLevel> {
    return new Promise<SubscriptionLevel>(async (resolve, reject) => {
      var sl = new SubscriptionLevel();

      sl.id = data.id;
      sl.disabled = data.disabled == 1 ? true : false;
      sl.disableReason = data.disable_reason;
      sl.application = await App.get(data.application_id);
      sl.name = data.name;
      sl.description = data.description;

      return resolve(sl);
    })
  }
}