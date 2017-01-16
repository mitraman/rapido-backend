var assert = require("assert")
var request = require("superagent")

var token = '';

describe('Projects', function() {
    before(function(done) {
        request
        .post('http://kai:go@localhost:8081/login')
        .end(function(err, res) {
            token = res.body.token;
            done();
        });
    })

    describe('Get All Projects', function() {
        it( 'should return a list of projects', function(done) {
            request
            .get('http://localhost:8081/projects')
            .set('Authorization', 'Bearer ' + token)
            .end(function(err, res) {
                assert.equal(200, res.status);
                done();
            });
        });
    })

    //TODO: find a valid project ID to use
    describe('Get project', function() {
        it( 'should return an individual project', function(done) {
            request
            .get('http://localhost:8081/projects/555cc17d1e604e396621d868')
            .set('Authorization', 'Bearer ' + token)
            .end(function(err, res) {
                assert.equal(200, res.status);
                done();
            });
        });
    })

    
    describe('Get projects', function() {
        it( 'should reject an invalid project id', function(done) {
            request
            .get('http://localhost:8081/projects/badid/')
            .set('Authorization', 'Bearer ' + token)
            .end(function(err, res) {
                assert.equal(404, res.status);
                //console.log(res.body);
                done();
            });
        });
    })

    describe('Create Project', function() {
        it( 'should create a new project', function(done) {
            var body = '{ "project" : { "name": "test", "description": "mocha test", "projectType": "CRUD", "contentType": "application/json" } }';
            request
            .post('http://localhost:8081/projects')
            .set('Authorization', 'Bearer ' + token)
            .set('Content-Type', 'application/json')
            .send(body)
            .end(function(err, res) {
                assert.equal(201, res.status);
                console.log(res);
                done();
            })
        })
    })
})
