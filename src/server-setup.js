const restify = require('restify');
const plugins = require('restify-plugins');
const da = require('./db/DataAccessor');
const validator = require('./handlers/validator');
const pgp = require('pg-promise')();
const passport = require('passport');
const passportManager = require('./security/passport-manager.js');
const winston = require('winston');

const users = require('./handlers/users.js');

const start = function start(dbConfig, serverPort, cb) {
  da.db = pgp(dbConfig);

  // Make sure the db connection works
  da.db.connect()
      .then((obj) => {
        obj.done(); // success, release the connection;
      })
      .catch((error) => {
        winston.warn('Database Connection Error:', error.message || error);
      });

  // Setup Passport routines for user authentication
  passportManager();

  // Setup the Restify server
  const server = restify.createServer({
    name: 'Rapido-API',
    version: '1.0.0',
  });

  server.use(plugins.acceptParser(server.acceptable));
  server.use(plugins.queryParser());
  server.use(plugins.jsonBodyParser());
  server.use(validator());

  // Setup routes
  server.post('/register', users.register);
  server.post('/login', passport.authenticate('basic', { session: false }), users.login);

  // Start the server
  server.listen(serverPort, () => {
    winston.log('%s listening at %s', server.name, server.url);
  });

  if (cb) {
    cb(server);
  }
};

module.exports = {
  start,
};
