const winston = require('winston');
const { Auth, User, App } = require("./dist");
const { UserPermissionsArray }= require('./dist/types/UserPermissionsArray.js')
const fs = require('fs');
require("dotenv").config();

var auth = new Auth({
    level: 'debug',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console({ format: winston.format.colorize() }),
        new winston.transports.File({ filename: 'debug.log', level: 'debug' }),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
    ]
})

setTimeout(async() => {
    try {
        var admin = await User.get('token');console.log(admin)
        var app = await App.get(-1);
        User.create(admin, app, 'verlox', 'testpass')
            .then(usr => {
                // User.get(0).then(console.log).catch(console.error);
                usr.application.owner = "REMOVED FOR OUTPUT"
                fs.writeFileSync(__dirname + 'user.txt', JSON.stringify(usr, null, 2));
            })
            .catch(console.error);
    }catch (e)
    {
        console.error(e);
    }
}, 500);