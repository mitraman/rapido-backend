"use strict";

const RapidoErrorCodes = require('../../src/errors/codes.js');
const ProblemDetailRepresenter = require('./problem-detail.js')();


module.exports = function() {

    return {

        convertRapidoError: function(error, title, resolution) {
          if( error.code === RapidoErrorCodes.fieldValidationError ) {
            return ProblemDetailRepresenter.fieldValidationMessage(error.code, title, error.message, error.fieldErrors);
          } else {
            return ProblemDetailRepresenter.errorMessage(error.code, title, error.message, resolution);
          }
        },

        errorMessage: function(code, title, detail, resolution) {
          return ProblemDetailRepresenter.errorMessage(code, title, detail, resolution);
        },
        fieldValidationMessage: function(code, title, detail, fieldProblems) {
          return ProblemDetailRepresenter.fieldValidationMessage(code, title, detail, fieldProblems);
        },
        responseMessage: function(message) {
            return message;
        }
    };
}
