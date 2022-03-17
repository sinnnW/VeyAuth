import { IVariableManager } from './interfaces/IVariableManager';
import { Variable } from './Variable';
import { User } from './User';
import { Core } from '..';

export class VariableManager implements IVariableManager {
  user: [Variable];
  application: [Variable];
  
  #auth: User;

  constructor(auth: User) {
    this.#auth = auth;
  }

  _getVarData(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      // Remove all items in array
      this.user.splice(0, this.user.length);
      this.application.splice(0, this.application.length);

      // Get all
      let vars = await Variable.getAll(this.#auth);

      // Iterate throught and populate arrays
      for (var x = 0;x < vars.length;x++) {
        if (vars[x].user)
          this.user.push(vars[x]);
        else
          this.application.push(vars[x]);
      }

      return resolve();
    })
  }
}