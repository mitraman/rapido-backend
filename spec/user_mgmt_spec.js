var user = require('../src/user-mgmt.js');
var da = require('../src/db/DataAccessor.js');
var Promise = require('promise');

describe('The user registration function', function() {
  const test_db = 'rapido-test';

  // Connect to the test database

  let mockDB = {};
  beforeEach(function() {
    // Setup the mock database
    mockDB = {
      one: function(sql, values) {
        return new Promise(function(resolve, reject) {
          resolve({});
        });
      },
      any: function(sql, values) {
        return new Promise(function(resolve, reject) {
          resolve([]);
        });
      }
    }
    da.db = mockDB;
  })


  it( 'should reject a user with a missing username param', function(done) {
    user.register(null, 'password', function(err) {
      expect(err).not.toBe(null);
      done();
    });
  })

  it( 'should reject a user with an empty username', function(done) {
    user.register('', 'password', function(err) {
      expect(err).not.toBe(null);
      done();
    })
  })

  it( 'should reject a user with a missing password param', function(done) {
    user.register('uname', null, function(err) {
      expect(err).not.toBe(null);
      done();
    })
  })

  it( 'should reject a user with an empty password', function(done) {
    user.register('uname', '', function(err) {
      expect(err).not.toBe(null);
      done();
    })
  })

  it( 'should return a new user ID when a user is added to the database', function(done) {
    var mockDBReturn = new Promise(function(resolve, reject) {
      resolve({id: 4});
    });
    spyOn(mockDB, 'one').and.returnValue(mockDBReturn);

    user.register('gooduser', 'goodpassword', function(err, user) {
      expect(mockDB.one).toHaveBeenCalled();
      expect(user.id).not.toBe(null);
      expect(user.id).toBeGreaterThan(0);
      done();
    })
  })

  it( 'should reject a duplicate user', function(done) {
    var mockDBReturn = new Promise(function(resolve, reject) {
      resolve([{id: 4}]);
    });
    spyOn(mockDB, 'any').and.returnValue(mockDBReturn);
    user.register('dupeuser', 'goodpassword', function(err, result) {
      expect(mockDB.any).toHaveBeenCalled();
        expect(err).not.toBe(null);
        done();
    });

  })

});
