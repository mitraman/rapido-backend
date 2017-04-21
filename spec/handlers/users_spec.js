"use strict";

const request = require("request");
const config = require('../../src/config.js');
const winston = require('winston');
const mailServer = require('../mail-server.js');
const authentication = require('../../src/security/authentication.js');
const dataAccessor = require('../../src/db/DataAccessor.js');


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

            expect(body.newUser).not.toBeUndefined();
            expect(body.newUser.id).not.toBeUndefined();

            const db = dataAccessor.getDb();
            let query = "SELECT * from users where email='" + email + "'";
            db.any(query)
            .then( (results) => {
              expect(results.length).toBe(1);
              done();
            })

            //winston.log('debug', res.body);
            // Mail verification has been disabled.
            //expect(mailServer.findEmail(email)).not.toBeUndefined();
            done();
        }
      )
    })

    it( 'should reject registration if the email already exists', function(done) {

      let duplicateEmail = 'dupliateemail@email.com'
      request.post(
        {
          url: registrationUrl,
          headers: headers,
          json: {
            fullname: 'New Name',
            nickname: 'CRLF',
            password: 'asdfasdf',
            email: duplicateEmail
          }
        },function(err, res, body) {
          expect(err).toBe(null);
          expect(res.statusCode).toBe(200);

          // Send second registration request with the same email
          request.post(
            {
              url: registrationUrl,
              headers: headers,
              json: {
                fullname: 'Second User',
                nickname: 'dupe',
                password: 'asdfasdf',
                email: duplicateEmail
              }
          }, function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(400);
            // Make sure that the user was not added to the database twice
            const db = dataAccessor.getDb();
            let query = "SELECT * from users where email='" + duplicateEmail + "'";
            db.any(query)
            .then( (results) => {
              expect(results.length).toBe(1);
              done();
            })
          });
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

    it( 'should return an authentication token for a valid user', function(done) {

      let uniqueEmail = 'logintest1.' + email;

      // Register a new user
      request.post(
        {
          url: registrationUrl,
          headers: headers,
          json: {
            fullname: 'Ronnie Mitra',
            nickname: 'ronnie',
            password: password,
            email: uniqueEmail
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
                  email: uniqueEmail
                }
              },function(err, res, body) {
                  expect(err).toBe(null);
                  expect(res.statusCode).toBe(200);
                  expect(body.token).not.toBeUndefined();
                  expect(body.token).not.toBeNull();
                  let token = body.token;

                  // Decode the token and make sure the properties are correct
                  let decoded = authentication.validateJWT(token);
                  winston.log('debug', 'decoded token', decoded);
                  expect(decoded.email).toBe(uniqueEmail);
                  expect(decoded.id).not.toBeUndefined();
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
