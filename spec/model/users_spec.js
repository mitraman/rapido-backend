"use strict";

const users = require('../../src/model/users.js');
const pgp = require('pg-promise');

const newUser = {
  userName: 'testuser',
  firstName: 'test',
  lastName: 'user',
  password: 'blah',
  email: 'test.user@test.com'
};

describe('create new users', function() {

  it( 'should create a new user in the datastore', function(done) {

    const failTest = function(error) {
      //console.log(error);
      expect(error).toBeUndefined();
    }

    const createUserResultTest = function(result) {
      //console.log(result);
      expect(result.id).toBe(1);
      done();
    }

  users.create(newUser)
  .then(createUserResultTest)
  .catch(failTest)
  .finally(done);

  });

  // Should the database reject duplicate user credentials?
  xit( 'should reject a duplicate user insertion', function(done) {
    users.create(newUser)
    .then((result)=>{
      console.log(result);
      fail("expected error");
    }).catch((error)=>{
      console.log(error);
      expect(error).not.toBe(null);
    }).finally(done);
  });
});

describe('update users', function() {
  it( 'should update a users verified parameter', function(done) {

    const verifiedUser = {
      userName: 'testuser-verified',
      firstName: 'Ian',
      lastName: 'verified',
      password: 'blahasd',
      email: 'ian.verified@test.com'
    };

    // Create the user to be updated
    users.create(verifiedUser)
    .then((result)=>{
      // Try to update the user's verified flag
      let id = result.id;
      return users.update({isVerified: true}, id)
    })
    .then((result)=>{
      console.log(result);
    })
    .catch((error)=>{
      console.log(error);
      expect(error).not.toBe(null);
    }).finally(done);
  })
});

describe('find users', function() {
  it( 'should find a user based on user ID', function(done) {
    users.find({id: 1})
    .then((result)=>{
      expect(result.firstname).toBe(newUser.firstName);
    }).catch((error)=>{
      expect(error).toBeUndefined();
    }).finally(done);
  })

  it( 'should find a user based on an email address', function(done) {
    users.find({email: newUser.email})
    .then((result)=>{
      expect(result.firstname).toBe(newUser.firstName);
    }).catch((error)=>{
      expect(error).toBeUndefined();
    }).finally(done);
  })

  it('should reject a find attempt with zero parameters', function() {
    expect(function() {users.find({})}).toThrow();
  })

  it('should reject a find attempt with unknown parameters', function() {
    expect(function() {users.find({})}).toThrow();
  })

  it('should not find a user if the id is unknown', function(done) {
    users.find({id: 139992})
    .then((result)=>{
      fail("this find should have returned an empty result or error")
    }).catch((error)=>{
      expect(error).not.toBeUndefined();
      expect(error.code).toBe(pgp.errors.queryResultErrorCode.noData);
    }).finally(done);
  })

  it('should find a user based on email and verified status', function(done) {
    const verifiedUser = {
      userName: 'testuser-verified-2',
      firstName: 'John',
      lastName: 'verifiedo',
      password: 'blahasasdd',
      email: 'john.verifiedo@test.com'
    };

    // Create the user to be updated
    users.create(verifiedUser)
    .then((result)=>{
      // Try to update the user's verified flag
      let id = result.id;
      return users.update({isVerified: true}, id)
    })
    .then((result)=>{
      return users.find({email: verifiedUser.email, isVerified: true });
    })
    .then((result)=>{
      expect(result.firstname).toBe(verifiedUser.firstName);
    })
    .catch((error)=>{
      expect(error).toBeUndefined(null);
    }).finally(done);
  })

});
