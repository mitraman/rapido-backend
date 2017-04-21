"use strict";

const authentication = require('../../src/security/authentication.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const winston = require('winston');
const jwt = require('jsonwebtoken');

describe('JWT functions', function() {

  it( 'should generate a new JWT', function() {
    const userdata = { email: "testuser@emaildomain.com" };

    let token = authentication.generateJWT(userdata)
    expect(token).not.toBeUndefined();
    expect(token).not.toBeNull();
  })

  it(' should validate a JWT', function() {
    const userdata = { email: "testuser@emaildomain.com" };
    // Generate a JWT
    let token = authentication.generateJWT(userdata)
    let decoded = authentication.validateJWT(token)
    expect(decoded.email).toBe(userdata.email);
  })

  it( 'should reject an invalid JWT', function() {
    let invalidToken = jwt.sign('testdata', 'differentsecret');
    expect(()=>{authentication.validateJWT(invalidToken)}).toThrow();
  })

});
