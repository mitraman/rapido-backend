"use strict";

var request = require("request");
var pgp = require('pg-promise')();
var config = require('../src/config.js');

const server_port = config.port;
const headers = {
  'Content-Type': 'application/json'
};

const username = 'testuser';
const password = 'password';

describe('Authentication', function() {

  const urlBase = 'http://localhost:' + server_port;

  describe('registration', function() {
    const registrationUrl = urlBase + '/register';

    it( 'should register a new user', function(done) {
      request.post(
        {
          url: registrationUrl,
          headers: headers,
          json: {
            username: username,
            password: password
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(200);
            done();
        }
      )
    })
  })

  describe('login', function() {
    const loginUrl = urlBase + '/login';

    it('should reject a login without any basic auth credentials', function(done) {
      request.post(
        {
          url: loginUrl,
          headers: headers
        }, function(err, res, body) {
          if(err) {
            fail(err);
          }
          expect(res.statusCode).toEqual(401);
          done();
        })
    });

    it('should reject a login with an unknown username', function(done) {
      request.post(
        {
          url: loginUrl,
          headers: headers
        }, function(err, res, body) {
          expect(res.statusCode).toEqual(401);
          done();
        }).auth('username', '', false);
    });

    it('should reject a login with an a bad password', function(done) {
      request.post(
        {
          url: loginUrl,
          headers: headers
        }, function(err, res, body) {
          expect(res.statusCode).toEqual(401);
          done();
        }).auth('username', 'badpassword', false);
    });

    it( 'return an auth token after a good login', function(done) {
      request.post(
        {
          url: loginUrl,
          headers: headers
        }, function(err, res, body) {
          expect(res.statusCode).toEqual(200);
          expect(body.token).not.toBe(null);
          done();
        }).auth(username, password, false);
    })

    xit( 'should ignore message bodies', function(done) {
      request.post(
        {
          url: registrationUrl,
          headers: headers,
        }, function(err, res, body) {
          expect(res.statusCode).toEqual(400);
          done();
        })
    });

  });

});
