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

  /**
   * This will update the cached data
   */
  _getData(): Promise<void> {
    return new Promise<void>(async (resolve, _) => {
      let files = await File.getAll(this.#auth); 
      this.all = files;
      resolve();
    })
  }

  /**
   * Create a new file
   * @param {string} fileName
   * @param {string} data
   * @param {boolean} priv
   * @returns {Promise<File>} File created
   */
  create(fileName: string, data: string, priv?: boolean): Promise<File> {
    return new Promise<File>(async (resolve, _) => {
      let f = await File.create(this.#auth, this.#auth.application, this.#auth, fileName, data, priv);
      await this._getData();
      return resolve(f);
    })
  }
}