"use strict";

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
        console.warn('Database Connection Error:', error.message || error);
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
  server.post('/api/register', users.register);
  server.post('/api/login', passport.authenticate('basic', { session: false }), users.login);

  // Serve static content on the root directory
  server.get(/\/?.*/, restify.serveStatic({
     directory: __dirname + '/public',
     default: 'index.html'
  }));


  // Start the server
  server.listen(serverPort, () => {
    console.log('%s listening at %s', server.name, server.url);
  });

  // Return the server to a callback function if one has been specified
  // TODO: turn this into a Promise
  if (cb) {
    cb(server);
  }
};

module.exports = {
  start,
};
