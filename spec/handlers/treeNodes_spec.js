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

  let sketchId = 10;

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
                  data: {
                    'get' : {
                      enabled: true,
                      request: {
                        contentType: 'application/json',
                        queryParams: '?name=value',
                        body: '{ "test": "testing" }'
                      },
                      response: {
                        status: '200',
                        contentType: 'application/json',
                        body: '{ "name": "some_value"}'
                      }
                    }
                  }
                }
              }, function( err, res, body) {
                expect(res.statusCode).toBe(200);
                let node = body.tree[0];
                expect(node.data.get).toBeDefined();
                expect(node.data.get.enabled).toBe(true);
                expect(node.data.get.request).toBeDefined();
                expect(node.data.get.request.contentType).toBe('application/json');
                expect(node.data.get.request.queryParams).toBe('?name=value');
                expect(node.data.get.request.body).toBe('{ "test": "testing" }');
                expect(node.data.get.response).toBeDefined();
                expect(node.data.get.response.contentType).toBe('application/json');
                expect(node.data.get.response.body).toBe('{ "name": "some_value"}');
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
                  data: {
                    'get' : {
                      enabled: true,
                      request: {
                        contentType: 'application/json',
                        queryParams: '?name=value',
                        body: '{}'
                      },
                      response: {
                        contentType: 'application/json',
                        body: '{ "name": "some_value"}'
                      }

                    }
                  }
                }
              }, function( err, res, body) {
                winston.log('debug', 'body:', body);
                expect(res.statusCode).toBe(200);
                let node = body.tree[0];
                expect(node.name).toBe('new_name');
                expect(node.data.get).toBeDefined();
                expect(node.data.get.enabled).toBe(true);
                expect(node.data.get.request.contentType).toBe('application/json');
                expect(node.data.get.response.contentType).toBe('application/json');
                expect(node.data.get.request.queryParams).toBe("?name=value");
                expect(node.data.get.request.body).toBe("{}");
                expect(node.data.get.response.body).toBe('{ "name": "some_value"}');
                done();
              }
            )
        }
      )
    })

    it('should udpate the enabled status of a node', function(done) {
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
                  data: {
                    'get' : {
                      enabled: false,
                    }
                  }
                }
              }, function( err, res, body) {
                winston.log('debug', 'body:', body);
                expect(res.statusCode).toBe(200);
                let node = body.tree[0];
                expect(node.name).toBe('new_name');
                expect(node.data.get).toBeDefined();
                expect(node.data.get.enabled).toBe(false);
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
                  data: {
                    'get' : {
                      enabled: true,
                      response: {
                        contentType: 'application/json',
                        body: '{ "name": "some_value"}'
                      }
                    },
                    'put' : {
                      enabled: false
                    },
                    'patch' : {
                      enabled: true,
                      response: {
                        contentType: 'application/json',
                        body: '{ "name": "some_other_value"}'
                      }
                    }
                  }
                }
              }, function( err, res, body) {
                //winston.log('debug', 'body:', body);
                expect(res.statusCode).toBe(200);
                let node = body.tree[0];
                expect(node.data.get).toBeDefined();
                expect(node.data.get.enabled).toBe(true);
                expect(node.data.get.response.contentType).toBe('application/json');
                expect(node.data.get.response.body).toBe('{ "name": "some_value"}');
                expect(node.data.put.enabled).toBe(false);
                expect(node.data.patch.enabled).toBe(true);
                done();
              }
            )
        }
      )
    })

    it('should reject an attempt to update a node that does not exist', function(done) {
      //console.log(nodesUrl);
      request.post(
        {
          url: nodesUrl,
          headers: headers
        },function(err, res, body) {
            expect(res.statusCode).toBe(201);
            let nodeUrl = paramaterizedNodeUrl.replace(/:nodeId/gi, 'bad-node-id');
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
                expect(res.statusCode).toBe(400);
                done();
              }
            )
        }
      )
    })

    it( 'should reject a request to change a sketch that is not owned by this user', function(done) {
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

  describe('PUT /nodes/:nodeId/move', function() {

    beforeAll(function(done) {
      this.paramaterizedNodeMoveUrl = paramaterizedNodeUrl + '/move';
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

    it('should reject a request that does not designate a target', function(done) {
      const nodeId = 'badid';
      let nodeMoveUrl = this.paramaterizedNodeMoveUrl.replace(/:nodeId/gi, nodeId);
      request.put(
        {
          url: nodeMoveUrl,
          headers: headers
        }, function( err, res, body) {
          winston.log('debug', 'body:', body);
          expect(res.statusCode).toBe(400);
          let bodyJSON = JSON.parse(body);
          expect(bodyJSON.error).toBe('Required field \'target\' is missing from request body');
          done();
        }
      );
    })

    it(' should reject a request to move a node that does not exist', function(done) {
      const nodeId = 'badid';
      let nodeMoveUrl = this.paramaterizedNodeMoveUrl.replace(/:nodeId/gi, nodeId);
      request.put(
        {
          url: nodeMoveUrl,
          headers: headers,
          json: {
            target: 'some-target'
          }
        }, function( err, res, body) {
          winston.log('debug', 'body:', body);
          expect(res.statusCode).toBe(400);
          expect(body.error).toBe('Cannot move node to non-existent target node with ID:some-target')
          done();
        }
      );
    })

    it(' should move a node ', function(done) {
      // Use the sketch service to create a tree
      let createEmptyNode = function(name, fullpath) {
        return {
          name: name,
          fullpath: fullpath
        }
      }

      let nodeA = createEmptyNode('a', '/a');
      let nodeB = createEmptyNode('b', '/b');
      let nodeC = createEmptyNode('c', '/c');
      let nodeD = createEmptyNode('d', '/d');

      //TODO: this test module needs to be cleaned up so that it uses 'this'
      let userId = userid;

      sketchService.addTreeNode(userId, sketchId, nodeA)
      .then( result => {
        nodeA.id = result.nodeId;
        return sketchService.addTreeNode(userId, sketchId, nodeB, nodeA.id);
      }).then( result => {
        nodeB.id = result.nodeId;
        return sketchService.addTreeNode(userId, sketchId, nodeC, nodeB.id);
      }).then( result => {
        nodeC.id = result.nodeId;
        return sketchService.addTreeNode(userId, sketchId, nodeD);
      }).then( result => {
        return nodeD.id = result.nodeId;
      }).then( result => {
        const nodeId = nodeC.id;
        let nodeMoveUrl = this.paramaterizedNodeMoveUrl.replace(/:nodeId/gi, nodeId);
        request.put(
          {
            url: nodeMoveUrl,
            headers: headers,
            json: {
              target: nodeD.id
            }
          }, function( err, res, body) {
            winston.log('debug', 'body:', body);
            expect(res.statusCode).toBe(200);
            expect(body.tree).toBeDefined();
            let a = body.tree[0];
            expect(a.id).toBe(nodeA.id);
            let b = a.children[0];
            expect(b.id).toBe(nodeB.id);
            expect(b.children.length).toBe(0);
            let d = body.tree[1];
            expect(d.id).toBe(nodeD.id);
            expect(d.children.length).toBe(1);
            let c = d.children[0];
            expect(c.id).toBe(nodeC.id);
            done();
          }
        );

      })
    })
  });
})
