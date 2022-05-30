const path = require('path');
const fs = require('fs');
const veyauth = require('veyauth');

const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
})

let env;
let db;

(async () => {
  await setupEnv();
  await setupDb();

  veyauth.dataDir = db;
})();

function setupEnv() {
  return new Promise((resolve, _) => {
    readline.question(`Is ${path.join(__dirname), '.env'} the environmental configuration file? [Y/n]: `, ans => {
      // Require a custom path
      if (!['y', ''].includes(ans.toLowerCase()) || !fs.existsSync(path.join(__dirname, '.env'))) {
        while (true) {
          readline.question('Input custom env path: ', pth => {
            if (fs.existsSync(pth)) {
              env = pth;
              return resolve();
            }
          });
        }
      } else
        env = config(path.join(__dirname, '.env'));
    })
  })
}

function setupDb() {
  return new Promise((resolve, _) => {
    if (!env) return console.error('Missing env!');
    
    readline.question(`Is ${path.join(__dirname, 'data', 'auth.db')} the correct database file? [Y/n]: `, ans => {
      if (!['y', ''].includes(ans.toLowerCase()) || !fs.existsSync(path.join(__dirname, 'data', 'auth.db'))) {
        while (true) {
          readline.question('Input custom DB path: ', pth => {
            if (fs.existsSync(pth)) {
              db = pth.split('auth.db')[0];
              return resolve();
            }
          })
        }
      }
    })
  })
}

