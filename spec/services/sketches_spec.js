"use strict";

const sketchService = require('../../src/services/sketches.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const winston = require('winston');
const uuidV4 = require('uuid/v4');

describe('CRUD sketch', function() {

  it('should store a new CRUD node', function(done) {
    let newNode = {
      sketchId: 10,
      user: 12,
      node: {
        parentId: 3,
        name: '/bleh',
        path: '/api/bleh',
        responseData: {
          'GET': {
            contentType: 'application/json',
            data: ''
          }
        }
      }
    }
    sketchService.addNode(newNode)
    .then( (result) => {
      expect(result.id).not.toBeUndefined();
      done();
    })
  })

  it('should update the responseData for an existing CRUD node', function(done) {
    sketchService.updateNodeData(nodeId, {
      'GET': {
        contentType: 'application/json',
        data: '{"sample": "data"}'
      }
    }).catch( (error) => {
      fail(error);
    }).finally(done);

  })

  it('should update a selected property of an existing CRUD node', function(done) {
    sketchService.updateNode(nodeId, {
      node: {
        parentId: 2,
      }
    })

  })

});
