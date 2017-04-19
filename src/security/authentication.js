"use strict";

const passport = require('passport');
const winston = require('winston');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const jwt = require('jsonwebtoken');

//TODO: get the secret from the environment
const secret = 'secret';

module.exports = {

	generateJWT: function(user) {
    let token = jwt.sign(user, secret);
    return token;
  }



}
