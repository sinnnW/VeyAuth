const winston = require('winston');
const {Auth, encodeUser} = require("./dist");
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

encodeUser({ usernane: "test", password: "test2"}, process.env.SESSION_SECRET);