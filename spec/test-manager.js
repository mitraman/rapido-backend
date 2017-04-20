/**
 * Setups and runs Jasmine tests located in the spec/ directory
 *
 **/
 "use strict";

var Jasmine = require('jasmine');
var jasmine = new Jasmine();
var serverManager = require('../src/server-setup.js');
var pgtools = require('pgtools');
var pgp = require('pg-promise')();
var config = require('../src/config.js');
const winston = require('winston');
const dataAccessor = require('../src/db/DataAccessor.js');
const mailServer = require('./mail-server.js');

// Set the log level
winston.level = 'error';

config.load('../rapido-test.json');

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
    console.log("Is there a postrgres database running?  Have you verified the connection parameters in rapid-test.json?");
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

    winston.log('info', 'Starting mock email server...');
    mailServer.start();

    winston.log('info', 'Starting Server and Jasmine tests...');

    serverManager.start(config.port, function(server, app) {

      jasmine.loadConfigFile('spec/support/jasmine.json');

      jasmine.onComplete(function(passed) {
          if(passed) {
              console.log('info', 'All specs have passed');
              server.close();
              process.exit();
          }
          else {
              console.log('At least one spec has failed');
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
