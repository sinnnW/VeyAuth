import { Variable } from '../Variable';

export interface IVariableManager {
  all: Variable[];
  user: Variable[];
  application: Variable[];

  _getData(): void;
}