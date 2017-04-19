"use strict";

const express = require('express');
const passport = require('passport');
const passportManager = require('./security/passport-manager.js');
const winston = require('winston');
const logger = require('morgan');
const bodyParser = require('body-parser');
const RapidoError = require('./errors/rapido-error.js');
const RapidoErrorCodes = require('./errors/codes.js');
const cors = require('cors');

const users = require('./handlers/users.js');


//TODO: Rename this to routesetup or something more meaningful

const start = function start(serverPort, cb) {

  // Setup Passport routines for user authentication
  passportManager();

  // Setup the express server
  const app = express();
  app.use(logger('dev'));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(cors());
  //server.use(express.static(path.join(__dirname, 'public')));

  winston.log('info', 'server is listening on port: ' + serverPort);

  let requestValidator = function(req, res, next) {
    // Make sure that the media type is JSON
    if( !req.is('application/json')  ) {
      throw new RapidoError(RapidoErrorCodes.unsupportedContentType, 'The content type ' + res.get('Content-Type') + ' is not supported.', 415);
    }

    // Reject the message if the client does not accept JSON
    if( !req.accepts('application/json') ) {
      throw new RapidoError(RapidoErrorCodes.unsupportedAcceptType, 'The content type ' + res.get('Content-Type') + ' specified in the accept header is not supported.', 415);
    }

    next();
  };

  app.use(requestValidator);

  // Setup routes
  app.post('/api/register', users.registrationHandler);
  // server.post('/api/register', users.register);
  // server.post('/api/login', passport.authenticate('basic', { session: false }), users.login);
  //
  // // Serve static content on the root directory
  // server.get(/\/?.*/, restify.serveStatic({
  //    directory: __dirname + '/public',
  //    default: 'index.html'
  // }));

  // Setup error handlers
  app.use(function (err, req, res, next) {
    winston.log('error', err.stack);
    if( err.name === 'RapidoError') {
      res.status(err.status).send(err.message);
    }else if( err.name === 'SyntaxError') {
      res.status(400).send('Malformed request body');
    }else {
      res.status(500).send('Something broke!')
    }
  })

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
