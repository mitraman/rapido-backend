"use strict";

var request = require("request");
var config = require('../../src/config.js');

describe('Authentication', function() {

  const server_port = config.port;
  const urlBase = 'http://localhost:' + server_port + '/api';
  const headers = {
    'Content-Type': 'application/json'
  };


  describe('registration', function() {
    const registrationUrl = urlBase + '/register';

    xit( 'should register a new user', function(done) {
      const username = "New User";
      const password = "password";
      const email = "new.user@domain.com";

      request.post(
        {
          url: registrationUrl,
          headers: headers,
          json: {
            username: username,
            password: password,
            email: email
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(200);
            done();
        }
      )
    })

    xit( 'should reject registration if the email already exists', function(done) {
      const username = "New User";
      const password = "password";
      const email = "new.user@domain.com";

      request.post(
        {
          url: registrationUrl,
          headers: headers,
          json: {
            username: username,
            password: password,
            email: email
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(400);
            done();
        }
      )
    })


    xit( 'should receive a verification email after registration', function(done) {
      const username = "New User";
      const password = "password";
      const email = "new.user@domain.com";

      request.post(
        {
          url: registrationUrl,
          headers: headers,
          json: {
            username: username,
            password: password,
            email: email
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(200);
            done();
        }
      )
    })

  })

});
