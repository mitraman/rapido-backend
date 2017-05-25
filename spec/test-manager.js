/**
 * Setups and runs Jasmine tests located in the spec/ directory
 *
 **/
 "use strict";

// Setup logger before any other requires so that the winston is active.
const winston = require('winston');
 // Set the log level
winston.level = 'debug';
 //winston.level = 'off';

const config = require('../src/config.js');
config.load('../rapido-test.json');
var Jasmine = require('jasmine');
var jasmine = new Jasmine();
var pgtools = require('pgtools');
var pgp = require('pg-promise')();

const dataAccessor = require('../src/db/DataAccessor.js');
//const mailServer = require('./mail-server.js');

// winston.remove(winston.transports.Console);
// winston.add(winston.transports.Console, {
//   level: 'debug',
//   colorize: false,
//   timestamp: true,
//   stringify: false,
//   formatter: function(options) {
//     let transactionId = '';
//     if( options.meta && options.meta.transactionId ) { transactionId = '[' + options.meta.transactionId + ']'}
//     return transactionId + ' ' + options.level + ': ' + options.message + '\t'
//     + ( options.meta ? JSON.stringify(options.meta) : '');
//   }
// })

// Use a test version of the database
const db_config = {
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password
};

winston.log('info', 'Trying to drop rapido-test database...');

pgtools.dropdb(db_config, 'rapido-test', function(err, res) {

  //Error code 3d000 means the DB didn't exist, which is fine
  if( err && (!err.pgErr || err.pgErr.code != '3D000')) {
    console.error(err);
    console.error("Is there a postrgres database running?  Have you verified the connection parameters in rapid-test.json?");
    process.exit(-1);
  }

  console.info('Trying to create rapido-test database...');
  pgtools.createdb(db_config, 'rapido-test', function(err, res) {
    if( err ) {
      console.error(err);
      process.exit(-1);
    }
    run();
  })
})

function run() {

  // initialize the database connection
  winston.log('debug', config.database);
  dataAccessor.start(config.database)
  .then(function(){
    let db = dataAccessor.getDb();
    // Initialize the database tables
    winston.log('info', 'Creating Users table...');
    var queryFile = new pgp.QueryFile('../sql/users.sql');
    return db.none(queryFile);
  }).then(function(res) {
    let db = dataAccessor.getDb();
    winston.log('info', 'Creating Projects table...');
    var queryFile = new pgp.QueryFile('../sql/projects.sql');
    return db.none(queryFile);
  }).then(function(res) {
    let db = dataAccessor.getDb();
    winston.log('info', 'Creating Sketches table...');
    var queryFile = new pgp.QueryFile('../sql/sketches.sql');
    return db.none(queryFile);
  }).then(function(res) {
    let db = dataAccessor.getDb();
    winston.log('info', 'Creating Events table...');
    var queryFile = new pgp.QueryFile('../sql/sketchevents.sql');
    return db.none(queryFile);
  }).then(function(res) {

    // winston.log('info', 'Starting mock email server...');
    // mailServer.start();
    const serverManager = require('../src/server-setup.js');
    serverManager.start(config.port, function(server, app) {


      jasmine.loadConfigFile('spec/support/jasmine.json');

      jasmine.onComplete(function(passed) {
          if(passed) {
              winston.log('info', 'All specs have passed');
              server.close();
              process.exit();
          }
          else {
              winston.log('info', 'At least one spec has failed');
              server.close();
              process.exit(-1);
          }
      });
      jasmine.execute();
    })


  })
  .catch(error=> {
    console.error(error);
  });
}
