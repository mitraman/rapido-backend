var request = require("superagent")

describe('Authentication', function() {
  var goodUser = {name: "good", password:"good"};

  beforeEach(function() {

  });

  afterEach(function() {

  });

  describe('When registering a new user with a missing user name', function() {
    it( 'should reject the registration attempt', function() {

    }
  });

    describe('When logging in with invalid credentials', function() {
  /*
    it('should reject the auth. request with a generic error message', function(done) {
            request
            .post('http://baduser:badpass@localhost:8081/login')
            .end(function(err, res) {
                assert.equal(401, res.status);
                done();
            });
        })
*/
    })


    describe('when trying to use an expired token', function() {
      it('should reject the access request and provide an explanation', function(done) {

      })
    })
})
