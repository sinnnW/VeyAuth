const winston = require('winston');
const { App, User, Var, Core } = require("./dist");
const { FLAGS } = require('./dist/types/UserPermissions.js');
const fs = require('fs');
require("dotenv").config();

// Start auth
new Core({
  level: 'debug',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.align(),
    winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
    transports: [
      new winston.transports.Console({ format: winston.format.colorize() }),
      new winston.transports.File({ filename: 'debug.log', level: 'debug' }),
      new winston.transports.File({ filename: 'error.log', level: 'error' }),
      new winston.transports.File({ filename: 'combined.log' }),
    ]
  })
  
  setTimeout(async() => {
    try {
      // getting an admin user and the application we be testing on
      var admin = await User.verify('token');
      var app = await App.get(0, App.GET_FLAGS.GET_BY_ID);
      
      // set the permissions on the global app to user level permissions
      (await User.get(1)).permissions.set(0, -1).save(admin);

      // test creating a new var appwide
      var v = await Var.create(admin, app, null, 'testkey', 'testvalue', true);
      
      var newuser = await User.create(admin, app, `verlox${Math.round(Math.random() * 999)}`, 'godcc')
      
      newuser.permissions.set(0, FLAGS.MODIFY_USERS);
      await newuser.permissions.save(admin);
      
      // await app.delete(newuser);
      await newuser.delete()
    }catch (e)
    {
      console.error(e);
    }
  }, 500);