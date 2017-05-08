"use strict";

const serverManager = require('./server-setup.js');
const config = require('./config.js');
const dataAccessor = require('../src/db/DataAccessor.js');
const winston = require('winston');

winston.level = 'debug';

winston.log('debug', 'loading configuration from rapido.json');
config.load('../rapido.json');

winston.log('debug', 'connecting to databse');
dataAccessor.start(config.database)

winston.log('debug', 'starting server...');
serverManager.start(config.port);
