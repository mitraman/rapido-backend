"use strict";

const authentication = require('../../src/security/authentication.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const userModel = require('../../src/model/users.js');
const winston = require('winston');
const dataAccessor = require('../../src/db/DataAccessor.js');

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

describe('Authentication Middleware', function() {

  beforeAll(function(){
    this.email = 'AuthenticationMiddlewareTest@email.com'
  })

  beforeEach(function(done) {
    //Delete users
    const db = dataAccessor.getDb();
    db.query('DELETE FROM users where email=$1', this.email )
    .catch(e => {
      fail(e);
    }).finally(done);
  })

  it('should validate a bearer token passed in the HTTP header', function(done) {

    let thisSpec = this;

    userModel.create({
      email: thisSpec.email,
      password: 'password',
      fullName: 'Full Name',
      nickName: 'nickname'
    }).then( result => {
      const userdata = { id: result.id, email: thisSpec.email };

      // Generate a JWT
      let token = authentication.generateJWT(userdata);

      let next = function(e) {
        expect(e).toBeUndefined();
        done();
      }
      let req = new Map();
      req.set('Authorization', 'Bearer ' + token);

      console.log('authenticating requrest...');
      authentication.authenticateRequest(req, null, next);
    });
  })

  it('should reject requests that are missing an authorization header', function(done) {
    let next = function(e) {
      expect(e).toBeDefined();
      expect(e.code).toBe(RapidoErrorCodes.authenticationProblem);
      done();
    }
    let req = new Map();
    authentication.authenticateRequest(req, null, next);
  })

  it('should reject requests that are not bearer token strings', function(done) {
    const userdata = { id: 1, email: "testuser@emaildomain.com" };
    let token = authentication.generateJWT(userdata);
    let next = function(e) {
      expect(e).toBeDefined();
      expect(e.code).toBe(RapidoErrorCodes.authenticationProblem);
      done();
    }
    let req = new Map();
    req.set('Authorization', token);
    authentication.authenticateRequest(req, null, next);
  })

  it('should reject an invalid bearer token', function(done) {
    let invalidToken = jwt.sign('testdata', 'differentsecret');
    let next = function(e) {
      expect(e).toBeDefined();
      expect(e.code).toBe(RapidoErrorCodes.authenticationProblem);
      done();
    }
    let req = new Map();
    req.set('Authorization', 'Bearer ' + invalidToken);
    authentication.authenticateRequest(req, null, next);
  })

  it('should reject a valid bearer token with credentials that no longer exist', function(done) {
    // Picking a user id that is unlikely to exist.  
    const userdata = { id: 1001, email: "testuser@emaildomain.com" };
    // Generate a JWT
    let token = authentication.generateJWT(userdata);

    let next = function(e) {
      expect(e).toBeDefined();
      expect(e.code).toBe(RapidoErrorCodes.userNotFound)
      done();
    }
    let req = new Map();
    req.set('Authorization', 'Bearer ' + token);
    authentication.authenticateRequest(req, null, next);
  })
})
