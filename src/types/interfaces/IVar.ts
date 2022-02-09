import { IBase } from './IBase';

export interface IVar extends IBase {
  key: string;
  value: string;
  private: boolean;
  appId: number;
  userId: number;
}