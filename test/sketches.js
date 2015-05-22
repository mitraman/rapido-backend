var assert = require("assert")
var request = require("superagent")

var token = '';
var sketchId = '555dbb65f929a15d719ec285';

describe('Sketches', function() {
    before(function(done) {
        request
        .post('http://kai:go@localhost:8081/login')
        .end(function(err, res) {
            token = res.body.token;
            done();
        });
    })

    describe('Get all sketches for a project', function() {
        it( 'should return a list of sketches', function(done) {
            request
            .get('http://localhost:8081/projects/555dbb65f929a15d719ec284/sketches')
            .set('Authorization', 'Bearer ' + token)
            .end(function(err, res) {
                assert.equal(200, res.status);
                done();
            });
        });
    })

    describe('Get a single sketch', function() {
        it( 'should return a sketch', function(done) {
            request
            .get('http://localhost:8081/sketches/' + sketchId)
            .set('Authorization', 'Bearer ' + token)
            .end(function(err, res) {
                assert.equal(200, res.status);
                console.log(res.body);
                done();
            });
        });
    })


    describe('Create Sketch', function() {
        it( 'should create a new sketch', function(done) {
            var message = {
                sketch: {
                    name: 'mocha test',
                    description: 'testing',
                }
            };

            request
            .post('http://localhost:8081/projects/projectId/sketches')
            .set('Authorization', 'Bearer ' + token)
            .set('Content-Type', 'application/json')
            .send(JSON.stringify(message))
            .end(function(err, res) {
                assert.equal(201, res.status);
                console.log(res.body);
                done();
            })
        })
    })
})

