'use strict';

module.exports = function RapidoError(code, message, status, fieldErrors, title, resolution) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
  this.code = code;
  this.status = status;
  this.fieldErrors = fieldErrors;
  this.title = title;
  this.resolution = resolution;
};

require('util').inherits(module.exports, Error);
