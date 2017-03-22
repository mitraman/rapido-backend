"use strict";

const registrationService = require('../../src/services/registration.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');

describe('register new users', function() {

  const password = "test-password";
  const firstName = "testFirstName";
  const lastName = "testLastName";
  const email = "duplicate.email@bad.com";

  it( 'should register a new user in the system', function(done) {

    const validEmail = "testEmail@email.com";

    registrationService.register(validEmail, password, firstName, lastName)
    .then((newUser)=>{
      expect(newUser).not.toBeUndefined();
      expect(newUser).not.toBe(null);

      expect(newUser.id).not.toBeUndefined();
      expect(newUser.id).not.toBe(null);
      expect(newUser.firstName).toBe(firstName);
      expect(newUser.lastName).toBe(lastName);
      expect(newUser.email).toBe(validEmail);
      expect(newUser.password).toBeUndefined();
    })
    .catch((error)=>{
      expect(error).toBeUndefined();
    }).finally(done);

  });

  it( 'should reject a user with a duplicate email address', function(done) {

    // First register a user
    registrationService.register(email, password, firstName, lastName)
    .then((newUser)=>{
      expect(newUser).not.toBeUndefined();
      expect(newUser).not.toBe(null);

      expect(newUser.id).not.toBeUndefined();
      expect(newUser.id).not.toBe(null);
      expect(newUser.firstName).toBe(firstName);
      expect(newUser.lastName).toBe(lastName);
      expect(newUser.email).toBe(email);
      expect(newUser.password).toBeUndefined();
    })
    .catch((error)=>{
      expect(error).toBeUndefined();
    }).finally(()=>{

      // Try to create the user again
      return registrationService.register(email, password, firstName, lastName);
    })
    .then((result)=>{
      fail("duplicate user not detected.")
    })
    .catch((error)=>{
      // This is the result we expect.
      expect(error).not.toBeUndefined();
      expect(error.code).toBe(RapidoErrorCodes.duplicateUser);
    })
    .finally(done);
  })

  it( 'should reject a user with an invalid email address', function(done) {

    const invalidEmail = "notagoodemailaddress";

    registrationService.register(invalidEmail, password, firstName, lastName)
    .then((newUser)=> {
      fail("the registration attempt should have been rejected");
    })
    .catch((error)=> {
      expect(error.code).toBe(RapidoErrorCodes.invalidField);
    })
    .finally(done);

  })

  it( 'should reject a user with a missing email ', function(done) {

    registrationService.register("", password, firstName, lastName)
    .then((newUser)=> {
      fail("the registration attempt should have been rejected");
    })
    .catch((error)=> {
      expect(error.code).toBe(RapidoErrorCodes.invalidField);
    })
    .finally(done);
  })

  it( 'should reject a user with a missing firstname ', function(done) {
    registrationService.register(email, password, " ", lastName)
    .then((newUser)=> {
      fail("the registration attempt should have been rejected");
    })
    .catch((error)=> {
      expect(error.code).toBe(RapidoErrorCodes.invalidField);
    })
    .finally(done);
  })

  it( 'should reject a user with a missing lastname ', function(done) {
    registrationService.register(email, password, firstName, "")
    .then((newUser)=> {
      fail("the registration attempt should have been rejected");
    })
    .catch((error)=> {
      expect(error.code).toBe(RapidoErrorCodes.invalidField);
    })
    .finally(done);
  })

  it( 'should reject a user with a missing password ', function(done) {
    registrationService.register(email, " ", firstName, lastName)
    .then((newUser)=> {
      fail("the registration attempt should have been rejected");
    })
    .catch((error)=> {
      expect(error.code).toBe(RapidoErrorCodes.invalidField);
    })
    .finally(done);
  })

  it( 'should reject a user with an insecure password ', function(done) {
    const insecurePassword = "123";

    registrationService.register(email, insecurePassword, firstName, lastName)
    .then((newUser)=> {
      fail("the registration attempt should have been rejected");
    })
    .catch((error)=> {
      expect(error.code).toBe(RapidoErrorCodes.invalidField);
    })
    .finally(done);
  })




});
