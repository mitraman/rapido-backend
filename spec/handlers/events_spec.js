"use strict";

const request = require("request");
const config = require('../../src/config.js');
const winston = require('winston');
const dataAccessor = require('../../src/db/DataAccessor.js');
const HandlerSupport = require('./support.js');

describe('/events API', function() {
  xit('should add a new event for an existing sketch', function(done) {

  })

  xit('should reject an attempt to add an event if the user is not authorized to change a sketch', function(done) {

  })
});
