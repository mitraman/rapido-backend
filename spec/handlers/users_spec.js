"use strict";

const request = require("request");
const config = require('../../src/config.js');
const winston = require('winston');

describe('Authentication', function() {

  const server_port = config.port;
  const urlBase = 'http://localhost:' + server_port + '/api';
  const headers = {
    'Content-Type': 'application/json'
  };

  describe('registration', function() {
    const registrationUrl = urlBase + '/register';

    const fullname = "New User";
    const nickname = "Rondo"
    const password = "password";
    const email = "new.usersspec@domain.com";

    const fieldErrorTest = function(jsonBody, done) {
      request.post(
        {
          url: registrationUrl,
          headers: headers,
          json: jsonBody
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(400);
            winston.log('debug', res.body);
            done();
        });
    };

    it( 'should register a new user', function(done) {


      request.post(
        {
          url: registrationUrl,
          headers: headers,
          json: {
            fullname: fullname,
            nickname: nickname,
            password: password,
            email: email
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(200);
            winston.log('debug', res.body);
            done();
        }
      )
    })

    it( 'should reject registration if the email already exists', function(done) {

      request.post(
        {
          url: registrationUrl,
          headers: headers,
          json: {
            fullname: 'New Name',
            nickname: 'CRLF',
            password: 'asdfasdf',
            email: email
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(400);
            done();
        }
      )
    })

    it( 'should reject registration if the email address property is missing', function(done) {
      const jsonBody = {
        fullname: fullname,
        nickname: nickname,
        password: password
      }
      fieldErrorTest(jsonBody, done);
    })

    it( 'should reject registration if the email address property is invalid', function(done) {
      const jsonBody = {
        fullname: fullname,
        nickname: nickname,
        password: password,
        email:'notagoodemail'
      }
      fieldErrorTest(jsonBody, done);
    })

    it( 'should reject registration if the email address property is empty', function(done) {
      const jsonBody = {
        fullname: fullname,
        nickname: nickname,
        password: password,
        email:''
      }
      fieldErrorTest(jsonBody, done);
    })

    it( 'should reject registration if the nickname property is missing', function(done) {
      const jsonBody = {
        fullname: fullname,
        email: email,
        password: password,
        snickname: 'misspelled'
      }
      fieldErrorTest(jsonBody, done);
    })

    it( 'should reject registration if the nickname property is empty', function(done) {
      const jsonBody = {
        fullname: fullname,
        email: email,
        password: password,
        nickname: ''
      }
      fieldErrorTest(jsonBody, done);
    })

    it( 'should reject registration if the fullname property is missing', function(done) {
      const jsonBody = {
        nofullname: fullname,
        email: email,
        password: password,
        nickname: nickname
      }
      fieldErrorTest(jsonBody, done);
    })

    it( 'should reject registration if the fullname property is empty', function(done) {
      const jsonBody = {
        fullname: '',
        email: email,
        password: password,
        nickname: nickname
      }
      fieldErrorTest(jsonBody, done);
    })

    it( 'should reject registration if the password property is missing', function(done) {
      const jsonBody = {
        fullname: fullname,
        email: email,
        nopassword: password,
        nickname: nickname
      }
      fieldErrorTest(jsonBody, done);
    })

    it( 'should reject registration if the password property is empty', function(done) {
      const jsonBody = {
        fullname: fullname,
        email: email,
        password: '',
        nickname: nickname
      }
      fieldErrorTest(jsonBody, done);
    })

    it( 'should reject registration if the password property is not long enough', function(done) {
      const jsonBody = {
        fullname: fullname,
        email: email,
        password: '123',
        nickname: nickname
      }
      fieldErrorTest(jsonBody, done);
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
