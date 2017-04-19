"use strict";

const request = require("request");
const config = require('../../src/config.js');
const winston = require('winston');
const mailServer = require('../mail-server.js');

// TODO: Setup a simluated email service so that we can test the verification process.

describe('Authentication API', function() {

  const server_port = config.port;
  const urlBase = 'http://localhost:' + server_port + '/api';
  const headers = {
    'Content-Type': 'application/json'
  };

  const registrationUrl = urlBase + '/register';
  const loginUrl = urlBase + '/login';


  describe('POST /register', function() {


    const fullname = "New User";
    const nickname = "Rondo"
    const password = "password";
    const email = "ronnie.mitra@gmail.com";

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
            //TODO: validate the response properties

            winston.log('debug', res.body);
            //TODO: replace with a spy
            expect(mailServer.findEmail(email)).not.toBeUndefined();
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

  describe('POST /login', function() {


    const password = "password";
    const email = "ronnie.mitra@gmail.com";

    fit( 'should return an authentication token for a valid user', function(done) {


      // Register a new user
      request.post(
        {
          url: registrationUrl,
          headers: headers,
          json: {
            fullname: 'Ronnie Mitra',
            nickname: 'ronnie',
            password: password,
            email: email
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(200);

            request.post(
              {
                url: loginUrl,
                headers: headers,
                json: {
                  password: password,
                  email: email
                }
              },function(err, res, body) {
                  expect(err).toBe(null);
                  expect(res.statusCode).toBe(200);
                  done();
              }
            )

        }
      )
    });

    it( 'should reject an authentication attempt with a bad password', function(done) {
      request.post(
        {
          url: loginUrl,
          headers: headers,
          json: {
            password: 'badpassword',
            email: email
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(401);
            done();
        }
      )
    })

    it( 'should reject an authentication attempt for an unknown user', function(done) {
      request.post(
        {
          url: loginUrl,
          headers: headers,
          json: {
            password: 'badpassword',
            email: 'baduser@email.com'
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(401);
            done();
        }
      )
    })
  });

});
