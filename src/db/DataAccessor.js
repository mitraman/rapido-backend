/*
 * Singleton Data Accessor for the Postgres Database
 */
const winston = require('winston');
const Promise = require('bluebird');
// use bluebird as the promise library so we can take advantage of "finally"
var options = {
    promiseLib: Promise
};
const pgp = require('pg-promise')(options);

"use strict";

var _db = null;

function getDb() {
  //winston.log('debug', 'returning database connection');
  //winston.log('debug', _db);
  if( _db === null ) {
    winston.log('warn', 'Attempting to retrieve database accessor but it hasn\'t been initalized with start() yet.');
    throw new Error('Database has not been initialized.  Use start() to initialize the database.');
  }
  return _db;
}

function start(dbConfig) {

  return new Promise(function( fulfill, reject) {

    winston.log('info', 'Attempting to start postgres database connection.');

    _db = pgp(dbConfig);

    winston.log('info', 'Testing the postgres connection.');
    // Make sure the db connection works
    _db.connect()
        .then((obj) => {
          obj.done(); // success, release the connection;
          winston.log('info', 'Database connection is up.')
          fulfill();
        })
        .catch((error) => {
          winston.log('warn', 'Database Connection Error:', error.message || error);
          reject(error);
        });
  });
}

module.exports = {
  start,
  getDb
}
