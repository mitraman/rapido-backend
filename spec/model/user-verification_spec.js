"use strict";

const verification = require('../../src/model/user-verification.js');
const pgp = require('pg-promise');
const winston = require('winston')
const uuidV4 = require('uuid/v4');
const RapidoError = require('../../src/errors/rapido-error.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');

describe('verification management', function() {

  it( 'should create a new user verification in the datastore', function(done) {

    const userId = 12;
    const token = uuidV4();

    verification.create(userId, token)
    .then((result)=> {
      expect(result.id).not.toBeUndefined();
    })
    .catch((error)=>{
      expect(error).toBeUndefined();
    })
    .finally(done);

  });

  it( 'should find a new verification in the datastore', function(done) {

    const userId = 8;
    const token = uuidV4();

    // First insert a new verification token
    verification.create(userId, token)
    .then((result)=> {
      // Try to find the token
      return verification.findByToken(token);
    })
    .then((result)=> {
      winston.log('debug', 'found a verification entry: ', result);
      expect(result.id).not.toBeUndefined();
      expect(result.userid).toBe(userId);
    })
    .catch((error)=>{
      expect(error).toBeUndefined();
    })
    .finally(done);

  });

  it('should return an error if a verification cannot be found', function(done) {
    const userId = 3;
    const token = uuidV4();

    // First insert a new verification token
    verification.create(userId, token)
    .then((result)=> {
      // Try to find the token
      return verification.findByToken('missing-token');
    })
    .then((result)=> {
      winston.log('debug', result);
      fail("unexpectedly returned a verification result.")
    })
    .catch((error)=>{
      expect(error).not.toBeUndefined();
      expect(error.name).toBe('QueryResultError');
      expect(error.code).toBe(0);
      winston.log('debug', error);
    })
    .finally(done);
  })

  it('should return a token when finding by id', function(done) {
    // First insert a new verification token
    verification.create('183', 'verify-code')
    .then((result)=> {
      // Try to find the token
      return verification.findById('183');
    })
    .then((result)=> {
      expect(result.verifytoken).toBe('verify-code');
    }).catch((error)=>{
      expect(error).toBeUndefined();
    }).finally(done);
  })

  it('should throw a QueryError if a token cannot be found by id', function(done) {
    // First insert a new verification token
    verification.create('183', 'verify-code')
    .then((result)=> {
      // Try to find the token
      return verification.findById('183');
    })
    .then((result)=> {
      fail('should have thrown an error');
    }).catch((error)=>{
      expect(error).toBeDefined();
      expect(error.name).toBe('QueryResultError');
    }).finally(done);
  })

  it( "should reject an attempt to delete verifications with unknown parameters", function() {
    const userId = 323;
    const token = uuidV4();

    expect(function() { verification.delete({badParam: 'unknown'}) } ).toThrowError(RapidoError);
  })

  it( 'should remove a verification from the datastore by token', function(done) {
    const userId = 323;
    const token = uuidV4();

    // First insert a new verification token
    verification.create(userId, token)
    .then((result)=> {
      return verification.delete({token: token})
    })
    .then(()=> {
      winston.log('debug', 'verification deleted');

      // Mkae sure the record is deleted by searching for it
      verification.findByToken(token)
      .then((result)=> {
        fail("found a verification entry that should have been deleted.")
      })
      .catch((error)=>{
        expect(error).not.toBeUndefined();
      })
    })
    .catch((error)=>{
      expect(error).toBeUndefined();
    })
    .finally(done);
  })

});
