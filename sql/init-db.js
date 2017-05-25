const winston = require('winston');
winston.level = 'debug';

const config = require('../src/config.js');
config.load('../rapido.json');

const dataAccessor = require('../src/db/DataAccessor.js');
const pgtools = require('pgtools');
var pgp = require('pg-promise')();

const db_config = {
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password
};

//TODO: This table creation logic is duplicated in the test-manager, it should be componentized
// so it can be reused
pgtools.createdb(db_config, config.database.database, function(err, res) {
  if( err ) {
    console.error(err);
    process.exit(-1);
  }
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
  }).then( res => {
    console.log('done');
    process.exit(0);
  })
})
