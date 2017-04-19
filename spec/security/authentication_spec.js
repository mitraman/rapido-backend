"use strict";

const authentication = require('../../src/security/authentication.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const winston = require('winston');

describe('JWT functions', function() {

  it( 'should generate a new JWT', function() {
    const username = 'testuser@emaildomain.com';

    let token = authentication.generateJWT(username);
    expect(token).not.toBe(undefined);
    console.log(token);
  })

  it(' should validate a JWT', function() {

  })

});
