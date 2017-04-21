"use strict";

const representer = require('../representers/json.js')();
const winston = require('winston');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const authentication = require('../security/authentication.js')

module.exports = {

	echoHandler: function(req, res, next) {
    res.send(representer.responseMessage(req.body));
  }
}
