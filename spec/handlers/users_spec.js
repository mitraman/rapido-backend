"use strict";

const request = require("request");
const config = require('../../src/config.js');
const winston = require('winston');
const registrationService = require('../../src/services/registration.js');
let userModel = require('../../src/model/users.js');
const authentication = require('../../src/security/authentication.js');
const dataAccessor = require('../../src/db/DataAccessor.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const RapidoError = require('../../src/errors/rapido-error.js');

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
    //console.log(this.email);
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

      spyOn(registrationService, 'register').and.callFake( (email, password, fullName, nickName, nodeMailerTransporter) => {
        return new Promise( (resolve,reject) => {
          resolve({
            newUser: {
              id: 101,
              fullName: 'First last',
              nickName: 'nickname',
              email: 'email@email.com',
              isVerified: false
            },
            token: 'token'
          })
        })
      })

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

            expect(body.user).toBeDefined();
            expect(body.user.id).toBe(101);
            expect(body.user.fullName).toBe('First last');
            expect(body.user.nickName).toBe('nickname');
            expect(body.user.email).toBe('email@email.com');
            expect(body.user.isVerified).toBe(false);
            done();
        }
      )
    })

    it( 'should reject registration if the email already exists', function(done) {

      spyOn(registrationService, 'register').and.callFake( (email, password, fullName, nickName, nodeMailerTransporter) => {
        return new Promise( (resolve,reject) => {
          reject(new RapidoError(
  					RapidoErrorCodes.duplicateUser,
  					"a user with this email address already exists",
  					400));
        })
      })


      request.post(
        {
          url: this.registrationUrl,
          headers: this.headers,
          json: {
            fullname: 'Second User',
            nickname: 'dupe',
            password: 'asdfasdf',
            email: 'email@email.com'
          }
      }, function(err, res, body) {
        expect(err).toBe(null);
        expect(res.statusCode).toBe(400);
        expect(body.code).toBe(RapidoErrorCodes.duplicateUser);
        expect(body.detail).toBe("a user with this email address already exists")
        done();
      });
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

      spyOn(registrationService, 'register').and.callFake( (email, password, fullName, nickName, nodeMailerTransporter) => {
        return new Promise( (resolve,reject) => {
          expect(nickName).toBe(fullName);
          resolve({
            newUser: {
              id: 101,
              fullName: 'First last',
              nickName: 'nickname',
              email: 'email@email.com',
              isVerified: false
            },
            token: 'token'
          })
        })
      })

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
  })

  describe('POST /resendEmail', function() {
    it('should attempt to resend an email if an email address is provided', function(done) {

      // it should call verify with the correct token
      spyOn(registrationService, 'resendVerificationEmail').and.callFake( email => {
        expect(email).toBe('myemail@email.com');
        return new Promise( (resolve,reject) => {
          resolve();
        })
      })

      request.post(
        {
          url: this.urlBase + '/resendEmail',
          headers: this.headers,
          json: {
            email: 'myemail@email.com'
          }
        },function( err, res, body ) {
          expect(err).toBe(null);
          expect(res.statusCode).toBe(204);
          done();
        }
      )
    })

    it('should reject a request that does not provide an email address', function(done) {
      request.post(
        {
          url: this.urlBase + '/resendEmail',
          headers: this.headers,
          json: {
            no_email: 'myemail@email.com'
          }
        },function( err, res, body ) {
          expect(err).toBe(null);
          expect(res.statusCode).toBe(400);
          expect(body.code).toBe(RapidoErrorCodes.fieldValidationError)
          done();
        }
      )
    })

    it('should provide an error message if something unexpected happens', function(done) {
      // it should call verify with the correct token
      spyOn(registrationService, 'resendVerificationEmail').and.callFake( email => {
        expect(email).toBe('myemail@email.com');
        return new Promise( (resolve,reject) => {
          reject(new RapidoError(RapidoErrorCodes.genericError, 'testing error handling', 543));
        })
      })

      request.post(
        {
          url: this.urlBase + '/resendEmail',
          headers: this.headers,
          json: {
            email: 'myemail@email.com'
          }
        },function( err, res, body ) {
          expect(err).toBe(null);
          expect(res.statusCode).toBe(543);
          expect(body.code).toBe(RapidoErrorCodes.genericError)
          done();
        }
      )

    })
  })

  describe('GET /verify', function() {

    beforeAll(function() {
      this.verifyUrl = this.urlBase + '/verify';
    })

    it('should reject a request that does not contain a token', function(done) {
      request.post(
        {
          url: this.verifyUrl,
          headers: this.headers,
          json: {
            notoken: 'mycode'
          }
        },function(err, res, body) {
          expect(err).toBe(null);
          expect(res.statusCode).toBe(400);
          expect(body.code).toBe(RapidoErrorCodes.fieldValidationError);
          done();
        }
      )
    })

    it( 'should return an authentication token when a user is verified', function(done) {

      // it should call verify with the correct token
      spyOn(registrationService, 'verify').and.callFake( token => {
        expect(token).toBe('mycode');
        return new Promise( (resolve,reject) => {
          resolve({
            userId: 15
          })
        })
      })

      // it should update the isverified column for this user
      spyOn(userModel, 'update').and.callFake( (params, id) => {
        expect(id).toBe(15);
        expect(params.isVerified).toBe(true);
      })

      // it should retrieve user details from the user data
      spyOn(userModel, 'find').and.callFake( params => {
        return new Promise( (resolve, reject) => {
          resolve([{
            id: 15,
            email: 'email@email.com',
            password: '$2a$04$fSygNGoF/MQgznyAp.Lxwut2IRgHIY3MCjIev3aVAHSWEi.e0IH0O',
            nickname: 'nickName',
            fullname: 'first last',
            isverified: true
          }])
        })
      } )

      request.post(
        {
          url: this.verifyUrl,
          headers: this.headers,
          json: {
            code: 'mycode'
          }
        },function(err, res, body) {
          expect(err).toBe(null);
          expect(res.statusCode).toBe(200);
          expect(body.token).toBeDefined();
          expect(body.email).toBe('email@email.com');
          expect(body.userId).toBe(15);
          expect(body.nickName).toBe('nickName');
          expect(body.fullName).toBe('first last');
          expect(body.isVerified).toBe(true);

          // Make sure the dependencies were called
          expect(userModel.find.calls.count()).toBe(1);
          expect(userModel.update.calls.count()).toBe(1);
          done();
        }
      )
    })

    it('should return an error when a token is not found', function(done) {
      spyOn(registrationService, 'verify').and.callFake( token => {
        expect(token).toBe('mycode');
        return new Promise( (resolve,reject) => {
          reject(new RapidoError(RapidoErrorCodes.invalidVerificationToken, "Unable to complete verification process", 400));
        })
      })

      request.post(
        {
          url: this.verifyUrl,
          headers: this.headers,
          json: {
            code: 'mycode'
          }
        },function(err, res, body) {
          console.log('got response:', body);
          expect(err).toBe(null);
          expect(res.statusCode).toBe(400);
          expect(body.code).toBe(RapidoErrorCodes.invalidVerificationToken);
          done();
        }
      )
    })

  })

  describe('POST /login', function() {

    it( 'should return an authentication token for a valid user', function(done) {

      spyOn(userModel, 'find').and.callFake( params => {
        return new Promise( (resolve, reject) => {
          resolve([{
            id: 1,
            email: 'email@email.com',
            password: '$2a$04$fSygNGoF/MQgznyAp.Lxwut2IRgHIY3MCjIev3aVAHSWEi.e0IH0O',
            nickname: 'nickName',
            fullname: 'first last',
            isverified: true
          }])
        })
      } )

      // Register a new user
      request.post(
        {
          url: this.loginUrl,
          headers: this.headers,
          json: {
            password: 'password',
            email: this.email
          }
        },function(err, res, body) {
          expect(err).toBe(null);
          expect(res.statusCode).toBe(200);
          expect(body.token).toBeDefined();
          expect(body.email).toBe('email@email.com');
          expect(body.userId).toBe(1);
          expect(body.nickName).toBe('nickName');
          expect(body.fullName).toBe('first last');
          expect(body.isVerified).toBe(true);
          done();
        }
      )
    });

    it( 'should reject an authentication attempt with a bad password', function(done) {

      spyOn(userModel, 'find').and.callFake( params => {
        return new Promise( (resolve, reject) => {
          resolve([{
            id: 1,
            email: 'email@email.com',
            password: '$2a$04$fSygNGoF/MQgznyAp.Lxwut2IRgHIY3MCjIev3aVAHSWEi.e0IH0O',
            nickname: 'nickName',
            fullname: 'first last',
            isverified: true
          }])
        })
      } )

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

      spyOn(userModel, 'find').and.callFake( params => {
        return new Promise( (resolve, reject) => {
          resolve([])
        })
      } )

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
