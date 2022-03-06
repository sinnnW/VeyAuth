import { App } from "./App";
import { User } from "./User";
import { SubscriptionLevel } from "./SubscriptionLevel";
import { ISubscription } from "./interfaces/ISubscription";

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

  static fill(data: any): Promise<Subscription> {
    return new Promise<Subscription>(async (resolve, reject) => {
      var sub = new Subscription();
  
      sub.id = data.id;
      sub.disabled = data.disabled;
      sub.disableReason = data.disable_reason;
      sub.application = await App.get(data.application_id);
      sub.user = await User.get(data.user_id);
      sub.level = await SubscriptionLevel.getById(data.level_id);
      sub.expiresAt = await new Date(data.expires_at * 1000);

      return resolve(sub);
    })
  }
}