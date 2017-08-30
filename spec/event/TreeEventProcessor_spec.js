"use strict";

const winston = require('winston');
const Promise = require('bluebird');
const eventProcessor = require('../../src/event/EventProcessor.js');

let treenodeAddedEvent = function(parentId, id, responseData) {
  return {
    id: 3,
    type: 'treenode_added',
    data: {
      parentId: parentId,
      node: {
        id: id,
        name: id,
        fullpath: '/' + id,
        children: []
      }
    }
  }
}

let emptyTree = function() {
  return {
    hash: {},
    rootNodes: [],
    deletedNodes: {}
  };
};

describe('TreeEventProcessor', function() {

  this.sketchId = 10;

  describe('processor', function() {

    it('should reject an attempt to apply an unknown tree event', function(done) {
      let sketchId = 4;
      let event = {
        type: 'tree_unknown'
      }
      eventProcessor.applyEvent(event)
      .then( () => {
        fail('the cache should have rejected this attempt')
      }).catch( e => {
        expect(e).toBeDefined();
        expect(e.startsWith('unable to handle an unknown event type')).toBe(true);
        done();
      })
    })

  })
  
});
