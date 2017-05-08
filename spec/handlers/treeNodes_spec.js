"use strict";

const request = require("request");
const config = require('../../src/config.js');
const winston = require('winston');
const dataAccessor = require('../../src/db/DataAccessor.js');
const HandlerSupport = require('./support.js');
const sketchService = require('../../src/services/sketches.js');

describe('handlers/nodes.js', function() {

  const server_port = config.port;
  const urlBase = 'http://localhost:' + server_port + '/api';
  let headers = {
    'Content-Type': 'application/json'
  };

  let nodesUrl = urlBase + '/sketches/10/nodes';
  let paramaterizedNodeUrl = urlBase + '/sketches/10/nodes/:nodeId';
  let token = "";
  let userid;

  describe('POST /nodes/:parentId', function() {

    beforeAll(function(done) {
      HandlerSupport.registerAndLogin('ProjectsTest')
      .then( (result) => {
        const authValue = 'Bearer ' + result.token;
        headers['Authorization'] = authValue;
        userid = result.userId;
        done();
      }).catch( (error) => {
        fail(error);
      })
    })

    beforeEach(function(done) {
      // remove the event history before each test
      const db = dataAccessor.getDb();
      db.query('delete from sketchevents;')
      .then( () => {
        // Flush all subscribers
        return sketchService.reset();
      }).finally(done);
    })

    it( 'should reject a request with an invalid JWT', function(done) {

      request.post(
        {
          url: nodesUrl,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIXVCJ9...TJVA95OrM7E20RMHrHDcEfxjoYZgeFONFh7HgQ'
          },
          json: {
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(401);
            done();
        }
      )
    });

    it( 'should create a new node at the root level (/nodes)', function(done) {

      request.post(
        {
          url: nodesUrl,
          headers: headers,
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(201);
            let jsonBody = JSON.parse(body);
            expect(jsonBody.tree).toBeDefined();
            expect(jsonBody.node).toBeDefined();
            expect(jsonBody.node.id).toBeDefined();
            done();
        }
      )
    })

    it( 'should create a new child node', function(done) {

      request.post(
        {
          url: nodesUrl,
          headers: headers
        },function(err, res, body) {
            expect(res.statusCode).toBe(201);
            let jsonBody = JSON.parse(body);
            expect(jsonBody.node.id).toBeDefined();
            let parentNodeId = jsonBody.node.id;
            let nodeUrl = paramaterizedNodeUrl.replace(/:nodeId/gi, parentNodeId);
            request.post(
              {
                url: nodeUrl,
                headers: headers
              }, function( err, res, body) {
                expect(res.statusCode).toBe(201);
                let jsonBody = JSON.parse(body);
                expect(jsonBody.node.id).toBeDefined();
                expect(jsonBody.tree).toBeDefined();
                done();
              }
            )
        }
      )
    })

    it( 'should reject an attempt to create a child for a node that does not exist', function(done) {

      let parentNodeId = 'bad-id';
      let nodeUrl = paramaterizedNodeUrl.replace(/:nodeId/gi, parentNodeId);
      request.post(
        {
          url: nodeUrl,
          headers: headers
        }, function( err, res, body) {
          expect(res.statusCode).toBe(400);
          done();
        }
      )
    })

    it('should update the name and path of a node', function(done) {
      request.post(
        {
          url: nodesUrl,
          headers: headers
        },function(err, res, body) {
            expect(res.statusCode).toBe(201);
            let jsonBody = JSON.parse(body);
            expect(jsonBody.node.id).toBeDefined();
            let nodeId = jsonBody.node.id;
            let nodeUrl = paramaterizedNodeUrl.replace(/:nodeId/gi, nodeId);
            request(
              {
                method: 'PATCH',
                url: nodeUrl,
                headers: headers,
                json: {
                  name: 'newname',
                  fullpath: '/newname'
                }
              }, function( err, res, body) {
                winston.log('debug', 'body:', body);
                expect(res.statusCode).toBe(200);
                let updatedNode = body.tree[0];
                expect(updatedNode.name).toBe('newname');
                expect(updatedNode.fullpath).toBe('/newname');
                done();
              }
            )
        }
      )
    })

    it( 'should update the response data of a node', function(done) {
      request.post(
        {
          url: nodesUrl,
          headers: headers
        },function(err, res, body) {
            expect(res.statusCode).toBe(201);
            let jsonBody = JSON.parse(body);
            expect(jsonBody.node.id).toBeDefined();
            let nodeId = jsonBody.node.id;
            let nodeUrl = paramaterizedNodeUrl.replace(/:nodeId/gi, nodeId);
            request(
              {
                method: 'PATCH',
                url: nodeUrl,
                headers: headers,
                json: {
                  responseData: {
                    'get' : {
                      enabled: true,
                      contentType: 'application/json',
                      body: '{ "name": "some_value"}'
                    }
                  }
                }
              }, function( err, res, body) {
                winston.log('debug', 'body:', body);
                expect(res.statusCode).toBe(200);
                let node = body.tree[0];
                expect(node.responseData.get).toBeDefined();
                expect(node.responseData.get.enabled).toBe(true);
                expect(node.responseData.get.contentType).toBe('application/json');
                expect(node.responseData.get.body).toBe('{ "name": "some_value"}');
                done();
              }
            )
        }
      )
    })

    it('should update both the response data and fields for a node', function(done) {
      request.post(
        {
          url: nodesUrl,
          headers: headers
        },function(err, res, body) {
            expect(res.statusCode).toBe(201);
            let jsonBody = JSON.parse(body);
            expect(jsonBody.node.id).toBeDefined();
            let nodeId = jsonBody.node.id;
            let nodeUrl = paramaterizedNodeUrl.replace(/:nodeId/gi, nodeId);
            request(
              {
                method: 'PATCH',
                url: nodeUrl,
                headers: headers,
                json: {
                  name: 'new_name',
                  responseData: {
                    'get' : {
                      enabled: true,
                      contentType: 'application/json',
                      body: '{ "name": "some_value"}'
                    }
                  }
                }
              }, function( err, res, body) {
                winston.log('debug', 'body:', body);
                expect(res.statusCode).toBe(200);
                let node = body.tree[0];
                expect(node.name).toBe('new_name');
                expect(node.responseData.get).toBeDefined();
                expect(node.responseData.get.enabled).toBe(true);
                expect(node.responseData.get.contentType).toBe('application/json');
                expect(node.responseData.get.body).toBe('{ "name": "some_value"}');
                done();
              }
            )
        }
      )
    })

    it('should update three response data keys for a node', function(done) {
      request.post(
        {
          url: nodesUrl,
          headers: headers
        },function(err, res, body) {
            expect(res.statusCode).toBe(201);
            let jsonBody = JSON.parse(body);
            expect(jsonBody.node.id).toBeDefined();
            let nodeId = jsonBody.node.id;
            let nodeUrl = paramaterizedNodeUrl.replace(/:nodeId/gi, nodeId);
            request(
              {
                method: 'PATCH',
                url: nodeUrl,
                headers: headers,
                json: {
                  responseData: {
                    'get' : {
                      enabled: true,
                      contentType: 'application/json',
                      body: '{ "name": "some_value"}'
                    },
                    'put' : {
                      enabled: false
                    },
                    'patch' : {
                      enabled: true,
                      contentType: 'application/json',
                      body: '{ "name": "some_other_value"}'
                    }
                  }
                }
              }, function( err, res, body) {
                winston.log('debug', 'body:', body);
                expect(res.statusCode).toBe(200);
                let node = body.tree[0];
                expect(node.responseData.get).toBeDefined();
                expect(node.responseData.get.enabled).toBe(true);
                expect(node.responseData.get.contentType).toBe('application/json');
                expect(node.responseData.get.body).toBe('{ "name": "some_value"}');
                expect(node.responseData.put.enabled).toBe(false);
                expect(node.responseData.patch.enabled).toBe(true);
                done();
              }
            )
        }
      )
    })

    it( 'should reject a request to change a sketch that is not owned by this user', function() {
      request.post(
        {
          url: nodesUrl,
          headers: headers
        },function(err, res, body) {
            expect(res.statusCode).toBe(201);
            let jsonBody = JSON.parse(body);
            expect(jsonBody.node.id).toBeDefined();
            let nodeId = jsonBody.node.id;
            let nodeUrl = paramaterizedNodeUrl.replace(/:nodeId/gi, nodeId);
            request(
              {
                method: 'PATCH',
                url: nodeUrl,
                headers: headers,
                json: {
                  name: 'newname',
                  fullpath: '/newname'
                }
              }, function( err, res, body) {
                winston.log('debug', 'body:', body);
                expect(res.statusCode).toBe(200);
                let updatedNode = body.tree[0];
                expect(updatedNode.name).toBe('newname');
                expect(updatedNode.fullpath).toBe('/newname');
                done();
              }
            )
        }
      )
    })
  })
})
