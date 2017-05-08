"use strict";

const registrationService = require('../../src/services/registration.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const winston = require('winston');
const nodemailer = require('nodemailer');
const verification = require('../../src/model/user-verification.js');
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

  // email verification has been disabled
  xit ('should send a verification email after registration', function(done) {
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
      expect(error.code).toBe(RapidoErrorCodes.invalidField);
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
      expect(error.code).toBe(RapidoErrorCodes.invalidField);
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
      expect(error.code).toBe(RapidoErrorCodes.invalidField);
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
      expect(error.code).toBe(RapidoErrorCodes.invalidField);
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
      expect(error.code).toBe(RapidoErrorCodes.invalidField);
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
      expect(error.code).toBe(RapidoErrorCodes.invalidField);
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

    registrationService.register(validEmail, password, fullName, nickName, mailTransporter)
    .then((result)=>{
      winston.log('debug', result);
      let newUser = result.newUser;
      expect(newUser).not.toBeUndefined();
      expect(newUser.id).not.toBeUndefined();
      expect(result.verificationToken).not.toBeUndefined();
      token = result.verificationToken;
      return registrationService.verify(newUser.id, token);
    })
    .then((result)=>{
      // Make sure that the verification was succesful by searching for the token
      // the token entry should not exist.
      verification.findByToken(token)
      .then((result)=>{
        fail("The verification token was not removed from the table");
      })
      .finally(done);
    })
    .catch((error)=>{
      winston.log('warn', error);
      expect(error).toBeUndefined();
    })

  });


  it( 'should reject a verification attempt with the wrong token for a user waiting for verification', function(done) {

    const validEmail = "verifytest2@email.com";
    // Generate a random token and assume that it isn't a duplicate
    const token = uuidV4();

    registrationService.register(validEmail, password, fullName, nickName, mailTransporter)
    .then((result)=>{
      winston.log('debug', result);
      let newUser = result.newUser;
      expect(newUser).not.toBeUndefined();
      expect(newUser.id).not.toBeUndefined();
      expect(result.verificationToken).not.toBeUndefined();
      return registrationService.verify(newUser.id, token);
    })
    .then((result)=>{
      fail("verification suceeded for a bad verification token");
    })
    .catch((error)=>{
      winston.log('debug', error);
      expect(error).not.toBeUndefined();
      expect(error.name).toBe('RapidoError');
      expect(error.code).toBe(RapidoErrorCodes.invalidVerificationToken);
    })
    .finally(done);

  })

  it( 'should reject a verification attempt with an unknown token and random user ID', function(done) {

    // Generate a random token and assume that it isn't a duplicate
    const token = uuidV4();

    registrationService.verify(10, token)
    .then((result)=>{
      fail("verification suceeded for an unknown verification token");
    })
    .catch((error)=>{
      winston.log('debug', error);
      expect(error).not.toBeUndefined();
      expect(error.name).toBe('RapidoError');
      expect(error.code).toBe(RapidoErrorCodes.invalidVerificationToken);
    })
    .finally(done);

  })

});
