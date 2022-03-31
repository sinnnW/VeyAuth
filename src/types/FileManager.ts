import { IFileManager } from './interfaces/IFileManager';
import { Core } from '..';
import { App } from './App';
import { User } from './User';
import { File } from './File';

export class FileManager implements IFileManager {
  #auth: User;

  user: File[] = [];
  all: File[] = [];

  constructor(auth: User) {
    this.#auth = auth;
  }

  _getData(): Promise<void> {
    return new Promise<void>(async (resolve, _) => {
      let files = await File.getAll(this.#auth); 

      this.all = files;
      this.user = files.filter(f => f.user != null);

      resolve();
    })
  }

  create(fileName: string, data: any, priv?: boolean): Promise<File> {
    return new Promise<File>(async (resolve, _) => {
      let f = await File.create(this.#auth, this.#auth.application, this.#auth, fileName, data, priv);
      await this._getData();
      return resolve(f);
    })
  }
}