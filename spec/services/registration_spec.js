"use strict";

const registrationService = require('../../src/services/registration.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const winston = require('winston');
const nodemailer = require('nodemailer');
const verificationModel = require('../../src/model/user-verification.js');
const userModel = require('../../src/model/users.js');
const uuidV4 = require('uuid/v4');
const dataAccessor = require('../../src/db/DataAccessor.js');
const bcrypt = require('bcrypt-nodejs');
const EmailService = require('../../src/services/Email.js');


//TODO: Mock the calls to the user model database service
describe('register new users', function() {

  const password = "test-password";
  const fullName = "test FirstName";
  const nickName = "testNick";
  const email = "regspec.email@bad.com";

  it( 'should register a new user in the system', function(done) {

    spyOn(EmailService, 'sendEmail').and.callFake( (recipientAddress, recipientName, title, htmlEmail, plainTextEmail) => {
      return;
    })

    const validEmail = "testEmail@email.com";

    registrationService.register(validEmail, password, fullName, nickName)
    .then((result)=>{
      let newUser = result.newUser;
      expect(newUser).not.toBeUndefined();
      expect(newUser).not.toBe(null);

      expect(newUser.id).not.toBeUndefined();
      expect(newUser.id).not.toBe(null);
      expect(newUser.fullName).toBe(fullName);
      expect(newUser.nickName).toBe(nickName);
      expect(newUser.email).toBe(validEmail);
      expect(newUser.password).toBeUndefined();
      expect(newUser.isVerified).toBe(false);
    })
    .catch((error)=>{
      winston.log('warn', error);
      expect(error).toBeUndefined();
    }).finally(done);

  });

  it( 'should bcrypt passwords when storing in the databse', function(done) {

    const validEmail = "passwordverification_testEmail@email.com";

    spyOn(EmailService, 'sendEmail').and.callFake( (recipientAddress, recipientName, title, htmlEmail, plainTextEmail) => {
      return;
    })

    registrationService.register(validEmail, password, fullName, nickName)
    .then((result)=>{
      // Check the database to see if the password has been encrypted
      const db = dataAccessor.getDb();
      const query = 'select password from users where id=' + result.newUser.id;
      db.one(query).then( (result)=> {
        let encryptedPassword = bcrypt.hashSync(password);
        // The hashes shouldn't be identical due to salting
        expect(result.password).not.toBe(encryptedPassword);
        bcrypt.compare(password, encryptedPassword, function(err, res) {
          expect(err).toBeNull();
          expect(res).toBe(true);
        })
      }).catch( (error)=> {
        expect(error).toBeNull();
        fail(error);
      }).finally(done)
    })
    .catch((error)=>{
      winston.log('warn', error);
      expect(error).toBeUndefined();
      fail(error);
    })
  })

  it ('should send a verification email after registration', function(done) {
    const validEmail = "testEmail2@email.com";

    spyOn(EmailService, 'sendEmail').and.callFake( (recipientAddress, recipientName, title, htmlEmail, plainTextEmail) => {
      expect(recipientAddress).toBe('testEmail2@email.com');
      expect(recipientName).toBe('test FirstName');
      expect(title).toBe('Welcome to Rapido');
      expect(htmlEmail).toBeDefined();
      expect(plainTextEmail).toBeDefined();
    })

    registrationService.register(validEmail, password, fullName, nickName)
    .then((result)=>{

    })
    .catch((error)=>{
      winston.log('warn', error);
      expect(error).toBeUndefined();
    }).finally(done);
  })

  it( 'should reject a user with a duplicate email address', function(done) {

    spyOn(EmailService, 'sendEmail').and.callFake( (recipientAddress, recipientName, title, htmlEmail, plainTextEmail) => {
      return;
    })


    // First register a user
    registrationService.register(email, password, fullName, nickName)
    .then((result)=>{
      let newUser = result.newUser;
      expect(newUser).not.toBeUndefined();
      expect(newUser).not.toBe(null);

      expect(newUser.id).not.toBeUndefined();
      expect(newUser.id).not.toBe(null);
      expect(newUser.fullName).toBe(fullName);
      expect(newUser.nickName).toBe(nickName);
      expect(newUser.email).toBe(email);
      expect(newUser.password).toBeUndefined();
    })
    .catch((error)=>{
      expect(error).toBeUndefined();
    }).finally(()=>{

      // Try to create the user again
      return registrationService.register(email, password, fullName, nickName);
    })
    .then((result)=>{
      fail("duplicate user not detected.")
    })
    .catch((error)=>{
      // This is the result we expect.
      expect(error).not.toBeUndefined();
      expect(error.name).toBe('RapidoError');
      expect(error.code).toBe(RapidoErrorCodes.duplicateUser);
    })
    .finally(done);
  })

  it( 'should reject a user with an invalid email address', function(done) {

    const invalidEmail = "notagoodemailaddress";

    registrationService.register(invalidEmail, password, fullName, nickName)
    .then((result)=> {
      fail("the registration attempt should have been rejected");
    })
    .catch((error)=> {
      expect(error.name).toBe('RapidoError');
      expect(error.code).toBe(RapidoErrorCodes.fieldValidationError);
      expect(error.fieldErrors[0].field).toBe('email');
      expect(error.fieldErrors[0].type).toBe('invalid');
    })
    .finally(done);

  })

  it( 'should reject a user with a blank email ', function(done) {

    registrationService.register("", password, fullName, nickName)
    .then((result)=> {
      fail("the registration attempt should have been rejected");
    })
    .catch((error)=> {
      expect(error.name).toBe('RapidoError');
      expect(error.code).toBe(RapidoErrorCodes.fieldValidationError);
      expect(error.fieldErrors[0].field).toBe('email');
      expect(error.fieldErrors[0].type).toBe('invalid');
    })
    .finally(done);
  })

  it( 'should reject a user with an empty email field', function(done) {

    registrationService.register(null, password, fullName, nickName)
    .then((result)=> {
      fail("the registration attempt should have been rejected");
    })
    .catch((error)=> {
      expect(error.name).toBe('TypeError');
    })
    .finally(done);
  })

  it( 'should reject a user with a missing full name ', function(done) {
    registrationService.register(email, password, " ", nickName)
    .then((result)=> {
      fail("the registration attempt should have been rejected");
    })
    .catch((error)=> {
      expect(error.name).toBe('RapidoError');
      expect(error.code).toBe(RapidoErrorCodes.fieldValidationError);
      expect(error.fieldErrors[0].field).toBe('fullname');
      expect(error.fieldErrors[0].type).toBe('invalid');
      //winston.log('debug', error);
    })
    .finally(done);
  })

  it( 'should reject a user with a missing nick name ', function(done) {
    registrationService.register(email, password, fullName, "")
    .then((result)=> {
      fail("the registration attempt should have been rejected");
    })
    .catch((error)=> {
      expect(error.name).toBe('RapidoError');
      expect(error.code).toBe(RapidoErrorCodes.fieldValidationError);
      expect(error.fieldErrors[0].field).toBe('nickname');
      expect(error.fieldErrors[0].type).toBe('invalid');
    })
    .finally(done);
  })

  it( 'should reject a user with a missing password ', function(done) {
    registrationService.register(email, " ", fullName, nickName)
    .then((result)=> {
      fail("the registration attempt should have been rejected");
    })
    .catch((error)=> {
      expect(error.name).toBe('RapidoError');
      expect(error.code).toBe(RapidoErrorCodes.fieldValidationError);
      expect(error.fieldErrors[0].field).toBe('password');
      expect(error.fieldErrors[0].type).toBe('invalid');
    })
    .finally(done);
  })

  it( 'should reject a user with an insecure password ', function(done) {
    const insecurePassword = "123";

    registrationService.register(email, insecurePassword, fullName, nickName)
    .then((newUser)=> {
      fail("the registration attempt should have been rejected");
    })
    .catch((error)=> {
      expect(error.name).toBe('RapidoError');
      expect(error.code).toBe(RapidoErrorCodes.fieldValidationError);
      expect(error.status).toBe(400);
      expect(error.fieldErrors[0].field).toBe('password');
      expect(error.fieldErrors[0].type).toBe('invalid');
    })
    .finally(done);
  })

});

describe('resend verification email', function() {

  beforeAll(function(done) {
    // Wait for the files to be loaded
    if( registrationService.isInitialized()) {
      done();
    }else {
      let checkInterval = setInterval(()=> {
        if( registrationService.isInitialized()) {
            clearInterval(checkInterval)
            done();
        }
      }, 100);
    }
  })

  //TODO: It should remove any previous verification emails
  it('should resend the verification email if the user is registered', function(done) {

    spyOn(userModel, 'find').and.callFake( params => {
      return new Promise( (resolve, reject) => {
        resolve([{
          id: 15,
          email: 'email@email.com',
          password: '$2a$04$fSygNGoF/MQgznyAp.Lxwut2IRgHIY3MCjIev3aVAHSWEi.e0IH0O',
          nickname: 'nickName',
          fullname: 'first last',
          isverified: false
        }])
      })
    });

    spyOn(verificationModel, 'findById').and.callFake( id => {
      return new Promise( (resolve,reject) => {
        resolve({verifytoken: 'valid-code'})
      })
    })

    spyOn(EmailService, 'sendEmail').and.callFake( (recipientAddress, recipientName, title, htmlEmail, plainTextEmail) => {
      return;
    })

    expect(registrationService.isInitialized()).toBe(true);


    registrationService.resendVerificationEmail('email@email.com')
    .then( result => {
      expect(userModel.find.calls.count()).toBe(1);
      expect(verificationModel.findById.calls.count()).toBe(1);
    }).catch( e => {
        fail(e);
    }).finally(done);

  })

  it('should reject a verification email attempt if the user is already verified', function(done) {
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
    });

    spyOn(EmailService, 'sendEmail').and.callFake( (recipientAddress, recipientName, title, htmlEmail, plainTextEmail) => {
      return;
    })

    registrationService.resendVerificationEmail('email@email.com')
    .then( result => {
      fail('this call should have failed');
    }).catch( e => {
      expect(e.name).toBe('RapidoError');
      expect(e.code).toBe(RapidoErrorCodes.alreadyVerified);
      expect(e.status).toBe(400);
      expect(EmailService.sendEmail.calls.count()).toBe(0);
    }).finally(done);
  })

  it('should reject a verification email attempt if the user does not exist', function(done) {
    spyOn(userModel, 'find').and.callFake( params => {
      return new Promise( (resolve, reject) => {
        resolve([]);
      })
    });

    spyOn(EmailService, 'sendEmail').and.callFake( (recipientAddress, recipientName, title, htmlEmail, plainTextEmail) => {
      return;
    })

    registrationService.resendVerificationEmail('email@email.com')
    .then( result => {
      fail('this call should have failed');
    }).catch( e => {
      expect(e.name).toBe('RapidoError');
      expect(e.code).toBe(RapidoErrorCodes.userNotFound);
      expect(e.status).toBe(400);
      expect(EmailService.sendEmail.calls.count()).toBe(0);
    }).finally(done);
  })

  it('should create a new verification token entry if one does not already exist for a registered user', function(done) {
    spyOn(userModel, 'find').and.callFake( params => {
      return new Promise( (resolve, reject) => {
        resolve([{
          id: 15,
          email: 'email@email.com',
          password: '$2a$04$fSygNGoF/MQgznyAp.Lxwut2IRgHIY3MCjIev3aVAHSWEi.e0IH0O',
          nickname: 'nickName',
          fullname: 'first last',
          isverified: false
        }])
      })
    });

    // Mock the PGsql error thrown when a token entry cannot be found
    spyOn(verificationModel, 'findById').and.callFake( id => {
      return new Promise( (resolve,reject) => {
        let error = new Error();
        error.name = 'QueryResultError';
        reject(error);
      })
    })

    spyOn(verificationModel, 'create').and.callFake( (userId, token) => {
      return new Promise( (resolve,reject) => {
        expect(userId).toBe(15);
        expect(token).toBeDefined();
        resolve();
      })
    })

    spyOn(EmailService, 'sendEmail').and.callFake( (recipientAddress, recipientName, title, htmlEmail, plainTextEmail) => {
      expect(recipientAddress).toBe('email@email.com');
    })

    registrationService.resendVerificationEmail('email@email.com')
    .then( result => {
      expect(userModel.find.calls.count()).toBe(1);
      expect(verificationModel.findById.calls.count()).toBe(1);
      expect(verificationModel.create.calls.count()).toBe(1);
    }).catch( e => {
        fail(e);
    }).finally(done);

  })

//TODO
  xit('should reject a rsend request if the maximum rate of email transmissions has already been reached', function(done) {
    fail('to be written');
    done();
  })
})

describe('verify a registered user', function() {

  const password = "test-password";
  const fullName = "test FirstName";
  const nickName = "testNick";
  const email = "regspec.email@testing.com";

  let token = '';

  it( 'should succesfully verify a user with a valid token', function(done) {

    const validEmail = "verifytest1@email.com";

    spyOn(verificationModel, 'findByToken').and.callFake(token => {
      expect(token).toBe('token')
      return new Promise( (resolve,reject) => {
        resolve(
          {
            id: 1,
            userid: 33,
            verifytoken: token,
            generatedat: 'time'
          });
      })
    })

    spyOn(verificationModel, 'delete').and.returnValue(new Promise( (resolve,reject) => { resolve(); }));

    registrationService.verify('token')
    .then( result => {
      expect(result.userId).toBe(33);
      expect(verificationModel.delete.calls.count()).toBe(1);
    }).finally(done);

  });


  it( 'should reject a verification attempt when a findByToken yields no results', function(done) {

    spyOn(verificationModel, 'findByToken').and.callFake(token => {
      return new Promise( (resolve,reject) => {
        // Simulate a pg-promise query error
        let error = new Error('Simluated Error Condition');
        error.name = 'QueryResultError';
        reject(error);
      })
    })

    spyOn(verificationModel, 'delete').and.returnValue(new Promise( (resolve,reject) => { resolve(); }));

    registrationService.verify('token')
    .then( result => {
      fail("verification suceeded for a bad verification token");
    }).catch( error => {
      expect(error).toBeDefined();
      expect(error.name).toBe('RapidoError');
      expect(error.code).toBe(RapidoErrorCodes.invalidVerificationToken);
      expect(error.status).toBe(400);
    }).finally(done);

  })

});
