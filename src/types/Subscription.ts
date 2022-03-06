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
}