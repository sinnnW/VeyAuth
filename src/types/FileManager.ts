import { IFileManager } from './interfaces/IFileManager';
import { App } from './App';
import { User } from './User';
import { File } from './File';

export class FileManager implements IFileManager {
  #auth: User;
  #app: App;

  application: File[];
  all: File[];

  constructor(auth: User, app: App) {
    this.#auth = auth;
    this.#app = app;
  }

  static create(auth: User, app: App, user: User | null, fileName: string, data: any, priv: boolean): Promise<File> {
    return new Promise<File>((resolve, reject) => {

    })
  }
}