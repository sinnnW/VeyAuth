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

  create(auth: User, user: User | null, fileName: string, data: any, priv: boolean): Promise<File> {
    return File.create(auth, auth.application, user || auth, fileName, data);
  }
}