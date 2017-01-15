/**
 * User managment functions
 */

var da = require('./db/DataAccessor.js')
var bcrypt = require('bcrypt-nodejs');

//TODO: put RapidoError in its own module
function RapidoError(status, message) {
  this.status = status;
  this.name = 'MyError';
  this.message = message || 'Default Message';
  this.stack = (new Error()).stack;
}
RapidoError.prototype = Object.create(Error.prototype);
RapidoError.prototype.constructor = RapidoError;

var registerUser = function(username, password, cb) {
  if( !username ) {
    cb(new RapidoError(400, 'Missing username'));
    return;
  }
  if( !password ) {
    cb(new RapidoError(400, 'Missing password'));
    return;
  }

  // Check if the user already exists
  da.db.any("select * from users where uname=$1", [username])
  .then(function (data){
    if( data.length > 0 ) {
      cb(new RapidoError(400, "A user with that username already exists."))
      return;
    }
  })
  .catch(function (error) {
    console.error(error);
    cb(new RapidoError(500, "Internal error."));
    return;
  })

  //  Hash the password and store the record in the database
  bcrypt.hash(password, null, null, function(err, hash) {
    var user = { username: username, password: hash };

    da.db.one("insert into users(uname, password) values($1, $2) returning id",
    [username, hash])
    .then(function (data) {
        cb(null, {id: data.id, username: username});
        return;
    })
    .catch(function (error) {
        console.error("ERROR:", error.message || error); // print error;
        cb(new RapidoError(500, "Internal Error"));
    });

  })

}


module.exports = {
  register : registerUser
}
