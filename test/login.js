var assert = require("assert")
var request = require("superagent")

describe('Login', function() {
    describe('invalid credentials', function() {
        it('should reject invalid credentials', function(done) {
            request
            .post('http://baduser:badpass@localhost:8081/login')
            .end(function(err, res) {
                assert.equal(401, res.status);
                done();
            });
        })
    })
    describe('Kai', function() {
        it('should provide a login token', function(done) {
            request
            .post('http://kai:go@localhost:8081/login')
            .end(function(err, res) {
                assert.equal(200, res.status);
                assert(res.body.token);
                done();
            });
        })
    })
})

