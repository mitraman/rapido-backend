"use strict";

const express = require('express');
const passport = require('passport');
const passportManager = require('./security/passport-manager.js');
const winston = require('winston');
const logger = require('morgan');
const bodyParser = require('body-parser');

const users = require('./handlers/users.js');

const start = function start(serverPort, cb) {

  // Setup Passport routines for user authentication
  passportManager();

  // Setup the express server
  const app = express();
  app.use(logger('dev'));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));
  //server.use(express.static(path.join(__dirname, 'public')));

  console.log(serverPort);


  // Setup routes
  // server.post('/api/register', users.register);
  // server.post('/api/login', passport.authenticate('basic', { session: false }), users.login);
  //
  // // Serve static content on the root directory
  // server.get(/\/?.*/, restify.serveStatic({
  //    directory: __dirname + '/public',
  //    default: 'index.html'
  // }));

  // Start the server
  const server = app.listen(serverPort, () => {
    console.log('%s listening at %s', app.name, app.url);
  });

  // Return the server to a callback function if one has been specified
  // TODO: turn this into a Promise
  if (cb) {
    cb(server, app);
  }
};

module.exports = {
  start
};
