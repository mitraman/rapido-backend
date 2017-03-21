"use strict";

var dataAccessor = require('../../src/db/DataAccessor.js');
var config = require('../../src/config.js');

describe('connect to the database', function() {
  // beforeEach(function() {
  //   dataAccessor.db = null;
  // })

  it( 'should provide a db connection to a working database', function(done) {

    // Get the database params from the configurator
    config.load('../rapido-test.json');

    const passTest = function() {
      expect(dataAccessor.getDb()).not.toBe(null);
    }

    const failTest = function(error) {
      expect(error).toBeUndefined();
    }

    dataAccessor.start(config.database)
      .then(passTest)
      .catch(failTest)
      .finally(done);

  });

  it( 'should throw an error if the parameter object is null', function(done) {
    const badDbConfig = null;

    const thenTest = function() {
      // If then is called the test failed, but not sure how to make a more
      // descriptive fail
      expect(true).toBe(false);
    }

    const catchTest = function(error) {
      expect(error).not.toBeUndefined();
    }

    dataAccessor.start(badDbConfig)
    .then(thenTest)
    .catch(catchTest)
    .finally(done);
  });

  it( 'should throw an error if the parameter object is invalid', function(done) {
    const badDbConfig = {};

    const thenTest = function() {
      // If then is called the test failed, but not sure how to make a more
      // descriptive fail
      expect(true).toBe(false);
    }

    const catchTest = function(error) {
      expect(error).not.toBeUndefined();
    }

    dataAccessor.start(badDbConfig)
    .then(thenTest)
    .catch(catchTest)
    .finally(done);
  });

  it( 'should throw an error if the database does not exist', function(done) {
    const badDbConfig = {
      host: '192.168.1.100',
      port: 5643,
      database: 'bad_db_name',
      user: 'user',
      password: 'password'
    };

    const thenTest = function() {
      // If then is called the test failed, but not sure how to make a more
      // descriptive fail
      expect(true).toBe(false);
    }

    const catchTest = function(error) {
      expect(error).not.toBeUndefined();
    }

    dataAccessor.start(badDbConfig)
    .then(thenTest)
    .catch(catchTest)
    .finally(done);

  });

});
