"use strict";

const representer = require('../representers/json.js')();
const winston = require('winston');
const RapidoError = require('../../src/errors/rapido-error.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');


function isEmpty(obj) {
  // From: http://stackoverflow.com/questions/679915/how-do-i-test-for-an-empty-javascript-object
  for(var prop in obj) {
      if(obj.hasOwnProperty(prop))
          return false;
  }

  return JSON.stringify(obj) === JSON.stringify({});
}

module.exports = {

	requestValidator: function(req, res, next) {

    if( !req.is('application/json') && ( req.method === 'POST' || req.method === 'PUT' ) ) {
      throw new RapidoError(RapidoErrorCodes.unsupportedContentType, 'The content type ' + req.get('Content-Type') + ' is not supported.', 415);
    }

    // Reject the message if the client does not accept JSON responses
    if( !req.accepts('application/json') ) {
      // Ignore if the exporter is being called
      if(req.url.indexOf('/export') < 0){
        throw new RapidoError(RapidoErrorCodes.unsupportedAcceptType, 'The content type ' + req.get('Accept') + ' specified in the HTTP accept header is not supported.', 406);
      }
    }

    next();
  }
}
