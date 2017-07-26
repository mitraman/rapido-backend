"use strict";

const request = require("request");
const config = require('../../src/config.js');
const winston = require('winston');
const dataAccessor = require('../../src/db/DataAccessor.js');
const HandlerSupport = require('./support.js');
const sketchService = require('../../src/services/sketches.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');


describe('handlers/nodes.js', function() {



  beforeAll(function(done) {
    const db = dataAccessor.getDb();

    this.server_port = config.port;
    this.urlBase = 'http://localhost:' + this.server_port + '/api';
    this.headers = {
      'Content-Type': 'application/json'
    };
    this.sketchIndex = 1;

    HandlerSupport.registerAndLogin('TreeNodesTest')
    .then( (result) => {
      const authValue = 'Bearer ' + result.token;
      this.headers['Authorization'] = authValue;
      this.userId = result.userId;
      // Create a test project
      return db.query("insert into projects (userid, name) values (" + this.userId + ", 'treeNodesTest') RETURNING id")
    }).then( result => {
      this.projectId = result[0].id;
      return db.query("insert into sketches (userid, projectid, sketchIndex) values ("
        + this.userId + ", " + this.projectId + ", 1) RETURNING id, sketchIndex");
    }).then( result => {
      this.sketchIndex = 1;
      this.sketchId = result[0].id;
      this.url = this.urlBase + '/projects/' + this.projectId + '/sketches/' + this.sketchIndex + '/nodes';
      done();
    }).catch( (error) => {
      console.log('ERROR!!!!!!!!!!!!!!!!');
      console.log(error);
      fail(error);
    }).finally(done);
  });

  beforeEach(function(done) {
    // remove the event history before each test
    const db = dataAccessor.getDb();
    db.query('delete from sketchevents;')
    .then( () => {
      // Flush all subscribers
      return sketchService.reset();
    }).finally(done);
  });

  describe('POST /nodes/:parentId', function() {

    it('should reject an operation on a node that is not part of a sketch owned by this user', function(done) {
      const db = dataAccessor.getDb();

      let userId = 0;
      let projectId = 0;

      // Create a project and sketch with a different user
      db.one("insert into users (fullname) values ('other user') returning id")
      .then( result => {
        userId = result.id;
        return db.one("insert into projects (userid, name) values (" + userId + ", 'project name') returning id");
      }).then( result => {
        projectId = result.id;
        return db.query("insert into sketches (projectid, userid, sketchIndex) values (" + projectId + ", " + userId + ", 1)");
      }).then( result => {
        // Make request for the unauthorized sketch
        let url = this.urlBase + "/projects/" + projectId + "/sketches/1/nodes";
        request.post(
          {
            url: url,
            headers: this.headers,
            json: {}
          }, function( err, res, body) {
            expect(res.statusCode).toBe(404);
            done();
          }
        );
      })
    })

    it( 'should reject a request with an invalid JWT', function(done) {

      request.post(
        {
          url: this.url,
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

    it('should return a 404 if a sketch does not exist', function(done) {
      let url = this.urlBase + '/projects/' + this.projectId + '/sketches/12/nodes';

      request.post(
        {
          url: url,
          headers: this.headers,
        },function(err, res, body) {
          console.log(body);
          let jsonBody = JSON.parse(body);
          expect(err).toBe(null);
          expect(res.statusCode).toBe(404);
          expect(jsonBody.code).toBe(RapidoErrorCodes.sketchNotFound);
          done();
        }
      )
    })

    it( 'should create a new node at the root level (/nodes)', function(done) {

      request.post(
        {
          url: this.url,
          headers: this.headers,
        },function(err, res, body) {
          expect(err).toBe(null);
          expect(res.statusCode).toBe(201);
          let jsonBody = JSON.parse(body);
          expect(jsonBody.tree).toBeDefined();
          expect(jsonBody.node).toBeDefined();
          expect(jsonBody.node.id).toBeDefined();
          expect(jsonBody.node.data).toBeDefined();
          done();
        }
      )
    })

    it( 'should create a new child node', function(done) {

      let thisSpec = this;

      request.post(
        {
          url: this.url,
          headers: this.headers
        },function(err, res, body) {
          expect(res.statusCode).toBe(201);
          let jsonBody = JSON.parse(body);
          expect(jsonBody.node.id).toBeDefined();
          let parentNodeId = jsonBody.node.id;

          let nodeUrl = thisSpec.url + '/' + parentNodeId;
          request.post(
            {
              url: nodeUrl,
              headers: thisSpec.headers
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

      let url = this.url + '/bad-id';
      request.post(
        {
          url: url,
          headers: this.headers
        }, function( err, res, body) {
          let jsonBody = JSON.parse(body);
          expect(res.statusCode).toBe(400);
          expect(jsonBody.code).toBe(RapidoErrorCodes.fieldValidationError);
          expect(jsonBody.fields[0].field).toBe('nodeId');
          expect(jsonBody.fields[0].type).toBe('invalid');
          done();
        }
      )
    })

    it('should update the name and path of a node', function(done) {
      let thisSpec = this;

      request.post(
        {
          url: this.url,
          headers: this.headers
        },function(err, res, body) {
            expect(res.statusCode).toBe(201);
            let jsonBody = JSON.parse(body);
            expect(jsonBody.node.id).toBeDefined();
            let nodeId = jsonBody.node.id;
            let nodeUrl = thisSpec.url + "/" + nodeId;
            request(
              {
                method: 'PATCH',
                url: nodeUrl,
                headers: thisSpec.headers,
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

      let thisSpec = this;

      request.post(
        {
          url: this.url,
          headers: this.headers
        },function(err, res, body) {
            expect(res.statusCode).toBe(201);
            let jsonBody = JSON.parse(body);
            expect(jsonBody.node.id).toBeDefined();
            let nodeId = jsonBody.node.id;
            let nodeUrl = thisSpec.url + "/" + nodeId;
            request(
              {
                method: 'PATCH',
                url: nodeUrl,
                headers: thisSpec.headers,
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
      let thisSpec = this;

      request.post(
        {
          url: this.url,
          headers: this.headers
        },function(err, res, body) {
            expect(res.statusCode).toBe(201);
            let jsonBody = JSON.parse(body);
            expect(jsonBody.node.id).toBeDefined();
            let nodeId = jsonBody.node.id;
            let nodeUrl = thisSpec.url + "/" + nodeId;
            request(
              {
                method: 'PATCH',
                url: nodeUrl,
                headers: thisSpec.headers,
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
      let thisSpec = this;

      request.post(
        {
          url: this.url,
          headers: this.headers
        },function(err, res, body) {
            expect(res.statusCode).toBe(201);
            let jsonBody = JSON.parse(body);
            expect(jsonBody.node.id).toBeDefined();
            let nodeId = jsonBody.node.id;
            let nodeUrl = thisSpec.url + "/" + nodeId;
            request(
              {
                method: 'PATCH',
                url: nodeUrl,
                headers: thisSpec.headers,
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
      let thisSpec = this;

      request.post(
        {
          url: this.url,
          headers: this.headers
        },function(err, res, body) {
            expect(res.statusCode).toBe(201);
            let jsonBody = JSON.parse(body);
            expect(jsonBody.node.id).toBeDefined();
            let nodeId = jsonBody.node.id;
            let nodeUrl = thisSpec.url + "/" + nodeId;
            request(
              {
                method: 'PATCH',
                url: nodeUrl,
                headers: thisSpec.headers,
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
      let thisSpec = this;
      request.post(
        {
          url: this.url,
          headers: this.headers
        },function(err, res, body) {
            expect(res.statusCode).toBe(201);
            let nodeUrl = thisSpec.url + '/bad-node-id';
            request(
              {
                method: 'PATCH',
                url: nodeUrl,
                headers: thisSpec.headers,
                json: {
                  name: 'newname',
                  fullpath: '/newname'
                }
              }, function( err, res, body) {
                winston.log('debug', 'body:', body);
                expect(res.statusCode).toBe(400);
                expect(body.code).toBe(RapidoErrorCodes.fieldValidationError);
                expect(body.fields[0]).toEqual({
                  field: 'nodeId',
                  type: 'invalid',
                  description: 'There is no node with this ID in this sketch'
                })
                done();
              }
            )
        }
      )
    })
  })

  describe('PUT /nodes/:nodeId/move', function() {

    beforeAll(function(done) {
      this.moveUrl = this.urlBase + '/projects/' + this.projectId + '/sketches/' + this.sketchIndex + '/nodes/:nodeId/move'  ;
      done();
    })

    it('should reject a request that does not designate a target', function(done) {
      const nodeId = 'badid';
      let nodeMoveUrl = this.moveUrl.replace(/:nodeId/gi, nodeId);
      request.put(
        {
          url: nodeMoveUrl,
          headers: this.headers
        }, function( err, res, body) {
          winston.log('debug', 'body:', body);
          expect(res.statusCode).toBe(400);
          let bodyJSON = JSON.parse(body);
          //console.log(bodyJSON);
          expect(bodyJSON.code).toBe(RapidoErrorCodes.fieldValidationError);
          expect(bodyJSON.fields[0].type).toBe('missing');
          expect(bodyJSON.fields[0].field).toBe('target');
          expect(bodyJSON.fields[0].description).toBe('Missing required field "target"');
          done();
        }
      );
    })

    it(' should reject a request to move a node that does not exist', function(done) {
      const nodeId = 'badid';
      let nodeMoveUrl = this.moveUrl.replace(/:nodeId/gi, nodeId);
      request.put(
        {
          url: nodeMoveUrl,
          headers: this.headers,
          json: {
            target: 'some-target'
          }
        }, function( err, res, body) {
          winston.log('debug', 'body:', body);
          expect(res.statusCode).toBe(400);
          expect(body.code).toBe(RapidoErrorCodes.fieldValidationError);
          expect(body.fields[0].type).toBe('invalid');
          expect(body.fields[0].field).toBe('targetNodeId');
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
      let userId = this.userId;
      let sketchId = this.sketchId;

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
        let nodeMoveUrl = this.moveUrl.replace(/:nodeId/gi, nodeId);
        request.put(
          {
            url: nodeMoveUrl,
            headers: this.headers,
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
