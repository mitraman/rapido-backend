"use strict";

const serverManager = require('./server-setup.js');
const config = require('./config.js');
const dataAccessor = require('../src/db/DataAccessor.js');
const winston = require('winston');

winston.level = 'debug';

console.log('loading configuration from rapido.json');
config.load('../rapido.json');

console.log('connecting to databse');
dataAccessor.start(config.database)

console.log('starting server...');
serverManager.start(config.port);
