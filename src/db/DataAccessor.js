/*
 * Singleton Data Accessor for the Postgres Database
 */
const Promise = require('bluebird');
// use bluebird as the promise library so we can take advantage of "finally"
var options = {
    promiseLib: Promise
};
const pgp = require('pg-promise')(options);

"use strict";

var _db = null;

function getDb() {
  return _db;
}

function start(dbConfig) {

  return new Promise(function( fulfill, reject) {


    _db = pgp(dbConfig);

    // Make sure the db connection works
    _db.connect()
        .then((obj) => {
          obj.done(); // success, release the connection;
          fulfill();
        })
        .catch((error) => {
          console.warn('Database Connection Error:', error.message || error);
          reject(error);
        });
  });
}

module.exports = {
  start,
  getDb
}
