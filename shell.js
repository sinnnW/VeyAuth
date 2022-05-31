const path = require('path');
const fs = require('fs');
const veyauth = require('./index.js');
const { Database } = require('sqlite3');

const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
})

let admin;

(async () => {
  // await setupEnv();
  await setupDb();

  veyauth.dataDir = db;
  veyauth.Core.start({});
  veyauth.db.get('SELECT * FROM permissions WHERE permissions = 1 AND application_id = -1 ', [], (err, data) => {
    if (err)
      throw err;

    if (data) {
      veyauth.db.get('SELECT token FROM users WHERE id = ?', [ data.user_id ], async (err, data) => {
        if (err)
          throw err;

        if (!data)
          throw new Error('[FATAL] Permissions exist for user that does not exist!');

        admin = await veyauth.User.verify(data.token);
      });
    } else 
      throw new Error('[FATAL] No user has Administrator permissions globally!');
  });

  while (true) {
    console.warn('Choose an option to manage:');
    console.log(' [1] Application')
    console.log(' [2] User');
    console.log(' [3] Variable');
    console.log(' [4] File');
    console.log(' [5] Subscription');
    console.log(' [6] Invite');

    readline.question('-> ', async ans => {
      switch (ans) {
        case '1':
          return await appManage();
        case '2':
          return await userManage();
        case '3':
          return await varManage();
        case '4':
          return await fileManage();
        case '5':
          return await subManage();
        case '6':
          return await inviteManage();
        default:
          return console.error('Invalid option');
      }
    });
  }
})();

function appManage() {
  return new Promise((resolve, _) => {

  });
}

function userManage() {
  return new Promise((resolve, _) => {
    console.warn('Choose an action:');
    console.log(' [1] Create');
    console.log(' [2] Modify');
    console.log(' [3] Delete');

    readline.question('-> ', async ans => {
      switch (ans) {
        case '1':
          readline.question('Application ID > ', appId => {
            readline.question('Username > ', username => {
              readline.question('Password > ', password => {
                readline.question('Permissions ID > ', async permissions => {
                  veyauth.User.create(admin, await veyauth.App.get(appId), username, password, permissions)
                    .then(user => {
                      console.log(`Created user ${user.format} with token ${user.token}`);
                    })
                    .catch(err => {
                      console.error(`Failed to create user: ${err}`);
                    })
                })
              })
            })
          })
          return;
        case '2':
          return;
        case '3':
          return;
      }
    });
  });
}

function varManage() {
  return new Promise((resolve, _) => {

  });
}

function fileManage() {
  return new Promise((resolve, _) => {

  });
}

function subManage() {
  return new Promise((resolve, _) => {

  });
}

function inviteManage() {
  return new Promise((resolve, _) => {

  });
}

// function setupEnv() {
//   return new Promise((resolve, _) => {
//     readline.question(`Is ${path.join(__dirname), '.env'} the environmental configuration file? [Y/n]: `, ans => {
//       // Require a custom path
//       if (!['y', ''].includes(ans.toLowerCase()) || !fs.existsSync(path.join(__dirname, '.env'))) {
//         while (true) {
//           readline.question('Input custom env path: ', pth => {
//             if (fs.existsSync(pth)) {
//               veyauth.dataDir = pth;
//               return resolve();
//             }
//           });
//         }
//       } else
//         // env = config(path.join(__dirname, '.env'));
//     })
//   })
// }

function setupDb() {
  return new Promise((resolve, _) => {
    readline.question(`Is ${path.join(__dirname, 'data', 'auth.db')} the correct database file? [Y/n]: `, async ans => {
      if (!['y', ''].includes(ans.toLowerCase()) || !fs.existsSync(path.join(__dirname, 'data', 'auth.db'))) {
        while (true) {
          readline.question('Input custom DB path: ', pth => {
            if (fs.existsSync(pth)) {
              veyauth.db = new Database(pth);
              return resolve();
            }
          });
        }
      }
    });
  });
}

