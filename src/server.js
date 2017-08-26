"use strict";

const winston = require('winston');

if( process.env.RAPIDO_LOGLEVEL ) {
  winston.level = process.env.RAPIDO_LOGLEVEL;
  console.log('starting with loglevel:', process.env.RAPIDO_LOGLEVEL);
}else {
  winston.level = 'debug';
}

const config = require('./config.js');
winston.log('debug', 'loading configuration from rapido.json');
config.load('../rapido.json');

const dataAccessor = require('../src/db/DataAccessor.js');
winston.log('debug', 'connecting to databse');
dataAccessor.start(config.database)

winston.log('debug', 'starting server...');
const serverManager = require('./server-setup.js');
serverManager.start(config.port);
