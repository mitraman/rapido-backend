'use strict';

module.exports = function RapidoError(code, message, status) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
  this.code = code;
  this.status = status;
};

require('util').inherits(module.exports, Error);
