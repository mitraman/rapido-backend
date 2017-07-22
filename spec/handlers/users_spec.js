"use strict";

const request = require("request");
const config = require('../../src/config.js');
const winston = require('winston');
const mailServer = require('../mail-server.js');
const authentication = require('../../src/security/authentication.js');
const dataAccessor = require('../../src/db/DataAccessor.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');

// TODO: Setup a simluated email service so that we can test the verification process.

describe('Authentication API', function() {

  beforeAll(function(){
    this.email = 'regtest@email.com';
    this.fullname = 'Registration Test';
    this.nickname = 'Reg';
    this.password = 'password123!'
    const server_port = config.port;
    this.urlBase = 'http://localhost:' + server_port + '/api';
    this.headers = {
      'Content-Type': 'application/json'
    };

    this.registrationUrl = this.urlBase + '/register';
    this.loginUrl = this.urlBase + '/login';
  })

  beforeEach(function(done) {
    // Delete the test user before each test
    const db = dataAccessor.getDb();
    console.log(this.email);
    db.query("DELETE from users where email = $1", this.email)
      .then(result => {
      }).catch(e => {
        console.log('ERROR : ', e);
        fail(e);
      }).finally(done);
  });

  const fieldErrorTest = function(jsonBody, done, spec, fieldName, type) {
    request.post(
      {
        url: spec.registrationUrl,
        headers: spec.headers,
        json: jsonBody
      },function(err, res, body) {
          expect(err).toBe(null);
          //console.log(body);
          expect(res.statusCode).toBe(400);
          winston.log('debug', res.body);
          expect(body.code).toBe(RapidoErrorCodes.fieldValidationError);
          expect(body.fields[0].field).toBe(fieldName);
          expect(body.fields[0].type).toBe(type);
          done();
      });
  };



  describe('POST /register', function() {

    it( 'should register a new user', function(done) {

      let thisSpec = this;
      request.post(
        {
          url: this.registrationUrl,
          headers: this.headers,
          json: {
            fullname: this.fullname,
            nickname: this.nickname,
            password: this.password,
            email: this.email
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(200);

            expect(body.newUser).not.toBeUndefined();
            expect(body.newUser.id).not.toBeUndefined();

            const db = dataAccessor.getDb();
            let query = "SELECT * from users where email='" + thisSpec.email + "'";
            db.any(query)
            .then( (results) => {
              expect(results.length).toBe(1);
            }).catch(e => {
              fail(e);
            }).finally(done);

            //winston.log('debug', res.body);
            // Mail verification has been disabled.
            //expect(mailServer.findEmail(email)).not.toBeUndefined();

        }
      )
    })

    it( 'should reject registration if the email already exists', function(done) {

      let thisSpec = this;

      request.post(
        {
          url: this.registrationUrl,
          headers: this.headers,
          json: {
            fullname: this.fullname,
            nickname: this.nickname,
            password: this.password,
            email: this.email
          }
        },function(err, res, body) {
          expect(err).toBe(null);
          expect(res.statusCode).toBe(200);

          // Send second registration request with the same email
          request.post(
            {
              url: thisSpec.registrationUrl,
              headers: thisSpec.headers,
              json: {
                fullname: 'Second User',
                nickname: 'dupe',
                password: 'asdfasdf',
                email: thisSpec.email
              }
          }, function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(400);
            expect(body.code).toBe(RapidoErrorCodes.duplicateUser);
            expect(body.detail).toBe("a user with this email address already exists")
            // Make sure that the user was not added to the database twice
            const db = dataAccessor.getDb();
            let query = "SELECT * from users where email='" + thisSpec.email + "'";
            db.any(query)
            .then( (results) => {
              expect(results.length).toBe(1);
            }).catch( e=> {
              fail(e);
            }).finally(done);
          });
        }
      )
    })

    it( 'should reject registration if the email address property is missing', function(done) {
      const jsonBody = {
        fullname: this.fullname,
        nickname: this.nickname,
        password: this.password
      }
      fieldErrorTest(jsonBody, done, this, 'email', 'missing');
    })

    it( 'should reject registration if the email address property is invalid', function(done) {
      const jsonBody = {
        fullname: this.fullname,
        nickname: this.nickname,
        password: this.password,
        email:'notagoodemail'
      }
      fieldErrorTest(jsonBody, done, this, 'email', 'invalid');
    })

    it( 'should reject registration if the email address property is empty', function(done) {
      const jsonBody = {
        fullname: this.fullname,
        nickname: this.nickname,
        password: this.password,
        email:''
      }
      fieldErrorTest(jsonBody, done, this, 'email', 'missing');
    })

    it( 'should populate the nickname field with the fullname value if the nickname property is missing', function(done) {
      const jsonBody = {
        fullname: this.fullname,
        email: this.email,
        password: this.password,
        snickname: 'misspelled key'
      }
      let thisSpec = this;
      request.post(
        {
          url: this.registrationUrl,
          headers: this.headers,
          json: jsonBody
      }, function(err, res, body) {
        expect(err).toBe(null);
        expect(res.statusCode).toBe(200);
        expect(body.newUser.nickName).toBe(thisSpec.fullname);
        done();
      });
    })

    it( 'should reject registration if the fullname property is missing', function(done) {
      const jsonBody = {
        nofullname: this.fullname,
        email: this.email,
        password: this.password,
        nickname: this.nickname
      }
      fieldErrorTest(jsonBody, done, this, 'fullname', 'missing');
    })

    it( 'should reject registration if the fullname property is empty', function(done) {
      const jsonBody = {
        fullname: '',
        email: this.email,
        password: this.password,
        nickname: this.nickname
      }
      fieldErrorTest(jsonBody, done, this, 'fullname', 'missing');
    })

    it( 'should reject registration if the password property is missing', function(done) {
      const jsonBody = {
        fullname: this.fullname,
        email: this.email,
        nopassword: this.password,
        nickname: this.nickname
      }
      fieldErrorTest(jsonBody, done, this, 'password', 'missing');
    })

    it( 'should reject registration if the password property is empty', function(done) {
      const jsonBody = {
        fullname: this.fullname,
        email: this.email,
        password: '',
        nickname: this.nickname
      }
      fieldErrorTest(jsonBody, done, this, 'password', 'missing');
    })

    it( 'should reject registration if the password property is not long enough', function(done) {
      const jsonBody = {
        fullname: this.fullname,
        email: this.email,
        password: '123',
        nickname: this.nickname
      }
      fieldErrorTest(jsonBody, done, this, 'password', 'invalid');
    })

    // Disabled until we reactivate email verification
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

    beforeEach(function(done) {

      //console.log('Registering user for login tests');
      // Register the test user
      request.post(
        {
          url: this.registrationUrl,
          headers: this.headers,
          json: {
            fullname: 'Login User',
            nickname: 'Logan',
            password: this.password,
            email: this.email
          }
        },function(err, res, body) {
          expect(err).toBe(null);
          expect(res.statusCode).toBe(200);
          done();
        }
      )
    })



    it( 'should return an authentication token for a valid user', function(done) {

      let thisSpec = this;
      // Register a new user
      request.post(
        {
          url: this.loginUrl,
          headers: this.headers,
          json: {
            password: this.password,
            email: this.email
          }
        },function(err, res, body) {
          expect(err).toBe(null);
          expect(res.statusCode).toBe(200);
          expect(body.token).toBeDefined();
          expect(body.email).toBeDefined();
          expect(body.userId).toBeDefined();
          expect(body.nickName).toBeDefined();
          expect(body.fullName).toBeDefined();
          let token = body.token;

          // Decode the token and make sure the properties are correct
          let decoded = authentication.validateJWT(token);
          winston.log('debug', 'decoded token', decoded);
          expect(decoded.email).toBe(thisSpec.email);
          expect(decoded.id).toBeDefined();
          done();
        }
      )
    });

    it( 'should reject an authentication attempt with a bad password', function(done) {
      request.post(
        {
          url: this.loginUrl,
          headers: this.headers,
          json: {
            password: 'badpassword',
            email: this.email
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(401);
            expect(body.code).toBe(RapidoErrorCodes.invalidLoginCredentials);
            done();
        }
      )
    })

    it( 'should reject an authentication attempt for an unknown user', function(done) {
      request.post(
        {
          url: this.loginUrl,
          headers: this.headers,
          json: {
            password: this.password,
            email: 'bademail'
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(401);
            expect(body.code).toBe(RapidoErrorCodes.invalidLoginCredentials);
            done();
        }
      )
    })
  });

});
