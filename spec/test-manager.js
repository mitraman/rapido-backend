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

// Use a test version of the database
const db_config = {
  host: process.env.npm_package_config_db_host,
  port: process.env.npm_package_config_db_port,
  user: process.env.npm_package_config_db_user,
  password: process.env.npm_package_config_db_password
};

console.info('Trying to drop rapido-test database...');

pgtools.dropdb(db_config, 'rapido-test', function(err, res) {

  //Error code 3d000 means the DB didn't exist, which is fine
  if( err && err.pgErr.code != '3D000') {
    console.error(err);
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
  const server_db_config = {
    host: process.env.npm_package_config_db_host,
    port: process.env.npm_package_config_db_port,
    database: 'rapido-test',
    user: process.env.npm_package_config_db_user,
    password: process.env.npm_package_config_db_password
  };


  console.info('Creating Users table...');
  let db = pgp(server_db_config);
  // Initialize the database tables
  var queryFile = new pgp.QueryFile('../sql/users.sql');
  db.none(queryFile)
  .catch(error=> {
    console.error(error);
  }).then(function(res) {


    console.log('Starting Jasmine tests...');
  serverManager.start(server_db_config, process.env.npm_package_config_port, function(server) {
    jasmine.loadConfigFile('spec/support/jasmine.json');

    jasmine.onComplete(function(passed) {
        if(passed) {
            console.log('All specs have passed');
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

});

}
