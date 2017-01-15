"use strict";

/**
 * User management functions
 */

const da = require('./db/DataAccessor.js');
const bcrypt = require('bcrypt-nodejs');
const winston = require('winston');

// TODO: put RapidoError in its own module
function RapidoError(status, message) {
  this.status = status;
  this.name = 'MyError';
  this.message = message || 'Default Message';
  this.stack = (new Error()).stack;
}
RapidoError.prototype = Object.create(Error.prototype);
RapidoError.prototype.constructor = RapidoError;

const registerUser = function registerUser(username, password, cb) {
  if (!username) {
    cb(new RapidoError(400, 'Missing username'));
    return;
  }
  if (!password) {
    cb(new RapidoError(400, 'Missing password'));
    return;
  }

  // Check if the user already exists
  da.db.any('select * from users where uname=$1', [username])
  .then((data) => {
    if (data.length > 0) {
      cb(new RapidoError(400, 'A user with that username already exists.'));
    }
  })
  .catch((error) => {
    winston.error(error);
    cb(new RapidoError(500, 'Internal error.'));
  });

  //  Hash the password and store the record in the database
  bcrypt.hash(password, null, null, (err, hash) => {
    da.db.one('insert into users(uname, password) values($1, $2) returning id',
    [username, hash])
    .then((data) => {
      cb(null, { id: data.id, username });
    })
    .catch((error) => {
      winston.error('ERROR:', error.message || error); // print error;
      cb(new RapidoError(500, 'Internal Error'));
    });
  });
};


module.exports = {
  register: registerUser,
};
