import { IVariableManager } from './interfaces/IVariableManager';
import { Variable } from './Variable';
import { User } from './User';

export class VariableManager implements IVariableManager {
  all: Variable[] = [];
  user: Variable[] = [];
  application: Variable[] = [];
  
  #auth: User;

  constructor(auth: User) {
    this.#auth = auth;
  }

  _getData(): Promise<void> {
    return new Promise(async (resolve, _) => {
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

        this.all.push(vars[x]);
      }

      return resolve();
    })
  }

  create(key: string,  value: string, priv: boolean = false): Promise<Variable> {
    return Variable.create(this.#auth, this.#auth.application, this.#auth, key, value, priv);
  }
}