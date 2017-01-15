var restify = require('restify');
var plugins = require('restify-plugins');
var setup = require('./setup');
var da = require('./db/DataAccessor');
var validator = require('./handlers/validator');
var pgp = require('pg-promise')();
var passport = require('passport');

var users = require('./handlers/users.js')

var start = function(dbConfig, server_port, cb) {

  da.db = pgp(dbConfig)

  // Make sure the db connection works
  da.db.connect()
      .then(function (obj) {
          obj.done(); // success, release the connection;
      })
      .catch(function (error) {
          console.warn("Database Connection Error:", error.message || error);
      });

  // Setup Passport routines for user authentication
  var passportManager = require('./security/passport-manager.js');
  passportManager();

  // Setup the Restify server
  const server = restify.createServer({
    name: 'Rapido-API',
    version: '1.0.0'
  });

  server.use(plugins.acceptParser(server.acceptable));
  server.use(plugins.queryParser());
  server.use(plugins.jsonBodyParser());
  server.use(validator());

  // Setup routes
  server.post('/register', users.register);
  server.post('/login', passport.authenticate('basic', {session: false}), users.login);

  // Start the server
  console.log(server_port);
  server.listen(server_port, function () {
    console.log('%s listening at %s', server.name, server.url);
  });

  if( cb ) {
    cb(server);
  }
}

module.exports = {
  start: start
}
