"use strict";

const registrationService = require('../../src/services/registration.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const winston = require('winston');

describe('register new users', function() {

  const password = "test-password";
  const fullName = "test FirstName";
  const nickName = "testNick";
  const email = "regspec.email@bad.com";

  it( 'should register a new user in the system', function(done) {

    const validEmail = "testEmail@email.com";

    registrationService.register(validEmail, password, fullName, nickName)
    .then((newUser)=>{
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
      expect(error).toBeUndefined();
    }).finally(done);

  });

  it( 'should reject a user with a duplicate email address', function(done) {

    // First register a user
    registrationService.register(email, password, fullName, nickName)
    .then((newUser)=>{
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
    .then((newUser)=> {
      fail("the registration attempt should have been rejected");
    })
    .catch((error)=> {
      expect(error.name).toBe('RapidoError');
      expect(error.code).toBe(RapidoErrorCodes.invalidField);
    })
    .finally(done);

  })

  it( 'should reject a user with a blank email ', function(done) {

    registrationService.register("", password, fullName, nickName)
    .then((newUser)=> {
      fail("the registration attempt should have been rejected");
    })
    .catch((error)=> {
      expect(error.name).toBe('RapidoError');
      expect(error.code).toBe(RapidoErrorCodes.invalidField);
    })
    .finally(done);
  })

  it( 'should reject a user with an empty email field', function(done) {

    registrationService.register(null, password, fullName, nickName)
    .then((newUser)=> {
      fail("the registration attempt should have been rejected");
    })
    .catch((error)=> {
      expect(error.name).toBe('TypeError');
    })
    .finally(done);
  })

  it( 'should reject a user with a missing full name ', function(done) {
    registrationService.register(email, password, " ", nickName)
    .then((newUser)=> {
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
    registrationService.register(email, password, fullName, "")
    .then((newUser)=> {
      fail("the registration attempt should have been rejected");
    })
    .catch((error)=> {
      expect(error.name).toBe('RapidoError');
      expect(error.code).toBe(RapidoErrorCodes.invalidField);
    })
    .finally(done);
  })

  it( 'should reject a user with a missing password ', function(done) {
    registrationService.register(email, " ", fullName, nickName)
    .then((newUser)=> {
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

    registrationService.register(email, insecurePassword, fullName, nickName)
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
