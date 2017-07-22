"use strict";

const RapidoErrorCodes = require('../../src/errors/codes.js');


/***

Reports API problems as detailed in RFC 7807
https://tools.ietf.org/html/rfc7807

***/

module.exports = function() {

    return {
        errorMessage: function(code, title, detail, resolution) {
          const errorType = 'http://rapidodesigner.com/api/problems/general';

          if( !code ) { code = RapidoErrorCodes.genericError };
          let body = {
            type: errorType,
            title: title,
            detail: detail,
            code: code,
            resolution: resolution
          };

          return body;
        },

        fieldValidationMessage: function(code, title, detail, fieldProblems) {
          const errorType = 'http://rapidodesigner.com/api/problems/field';

          if( !code ) { code = RapidoErrorCodes.genericError };
          let body = {
            type: errorType,
            title: title,
            detail: detail,
            code: code,
            fields: fieldProblems
          };

          return body;

        },
        responseMessage: function(message) {
            throw Error('The problem-details representer can only be used for error conditions.');
        }
    };
}
