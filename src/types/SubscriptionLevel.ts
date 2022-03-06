import { App } from './App';
import { User } from './User';
import { ISubscriptionLevel } from './interfaces/ISubscriptionLevel';

export class SubscriptionLevel implements ISubscriptionLevel {
  // IBase attributes
  id: number;
  disabled: boolean;
  disableReason?: string

  // ISubscriptionLevel attributes
  application: App;
  user: User;
  name: string;
  description?: string;

  static getById(id: number): Promise<SubscriptionLevel> {
    return new Promise<SubscriptionLevel>((resolve, reject) => {
      
    })
  }
}