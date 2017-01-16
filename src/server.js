"use strict";

const serverManager = require('./server-setup.js');
const config = require('./config.js');
const winston = require('winston');

winston.level = 'debug';

console.log('loading configuration from rapido.json');
config.load('../rapido.json');
console.log('starting server...');
serverManager.start(config.database, config.port);
