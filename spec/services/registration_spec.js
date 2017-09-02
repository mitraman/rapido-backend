"use strict";

const registrationService = require('../../src/services/registration.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const winston = require('winston');
const nodemailer = require('nodemailer');
const verificationModel = require('../../src/model/user-verification.js');
const uuidV4 = require('uuid/v4');
const dataAccessor = require('../../src/db/DataAccessor.js');
const bcrypt = require('bcrypt-nodejs');

// Mock email transport used to test the email verfication code
let mailData = {};

let transport = {
    name: 'minimal',
    version: '0.1.0',
    send: (mail, callback) => {
        winston.log('debug', 'pretending to send an email');
        //winston.log('debug', 'storing email: ', mail)
        // Store the email in the mailData variable for later verification
        //winston.log("debug", "email recipient:" + mail.data.to);
        //winston.log("debug", mail);
        mailData[mail.data.to] = mail;
        let envelope = mail.message.getEnvelope();
        let messageId = mail.message.messageId();
        callback(null, {
           envelope,
           messageId
       });
    }
};
const mailTransporter  = nodemailer.createTransport(transport);

//TODO: Mock the calls to the user model database service
describe('register new users', function() {

  const password = "test-password";
  const fullName = "test FirstName";
  const nickName = "testNick";
  const email = "regspec.email@bad.com";

  it( 'should register a new user in the system', function(done) {

    const validEmail = "testEmail@email.com";

    registrationService.register(validEmail, password, fullName, nickName, mailTransporter)
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

    registrationService.register(validEmail, password, fullName, nickName, mailTransporter)
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

    registrationService.register(validEmail, password, fullName, nickName, mailTransporter)
    .then((result)=>{
      let newUser = result.newUser;
      winston.log('debug', newUser);
      //winston.log('debug', mailData[validEmail]);
      winston.log('debug', 'mailData keys:', Object.keys(mailData));
      expect(mailData[validEmail]).not.toBeUndefined();
      expect(mailData[validEmail]).not.toBeNull();
    })
    .catch((error)=>{
      winston.log('warn', error);
      expect(error).toBeUndefined();
    }).finally(done);
  })

  it( 'should reject a user with a duplicate email address', function(done) {

    // First register a user
    registrationService.register(email, password, fullName, nickName, mailTransporter)
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
      return registrationService.register(email, password, fullName, nickName, mailTransporter);
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

    registrationService.register(invalidEmail, password, fullName, nickName, mailTransporter)
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

    registrationService.register("", password, fullName, nickName, mailTransporter)
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

    registrationService.register(null, password, fullName, nickName, mailTransporter)
    .then((result)=> {
      fail("the registration attempt should have been rejected");
    })
    .catch((error)=> {
      expect(error.name).toBe('TypeError');
    })
    .finally(done);
  })

  it( 'should reject a user with a missing full name ', function(done) {
    registrationService.register(email, password, " ", nickName, mailTransporter)
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
    registrationService.register(email, password, fullName, "", mailTransporter)
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
    registrationService.register(email, " ", fullName, nickName, mailTransporter)
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

    registrationService.register(email, insecurePassword, fullName, nickName, mailTransporter)
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
