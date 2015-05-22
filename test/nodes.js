var assert = require("assert")
var request = require("superagent")

var token = '';
var sketchId = '555dbb65f929a15d719ec285';

describe('HypermediaNodes', function() {
    before(function(done) {
        request
        .post('http://kai:go@localhost:8081/login')
        .end(function(err, res) {
            token = res.body.token;
            done();
        });
    })

    describe('Get All Hypermedia Nodes', function() {
        it( 'should return a list of nodes for a particular sketch', function(done) {
            request
            .get('http://localhost:8081/sketches/' + sketchId + '/hypernodes')
            .set('Authorization', 'Bearer ' + token)
            .end(function(err, res) {
                console.log(res.body);
                assert.equal(200, res.status);
                done();
            });
        });
    })


    describe('Create Node', function() {
        it( 'should create a new node', function(done) {

            var message = 
            {
                node: {
                    url: "/test",
                    description: "testing",
                    contentType: 'application/json',
                    method: "GET",
                    body: {}
                }
            }
            
        request
            .post('http://localhost:8081/sketches/' + sketchId + '/hypernodes')
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

