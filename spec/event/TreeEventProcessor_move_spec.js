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
    rootNode: null,
    deletedNodes: {}
  };
};

describe('TreeEventProcessor:MoveNode', function() {

  beforeEach(function(done) {
    // Setup a tree for test operations:
    /*
              --> c
    a -> b ->
              --> d --> e
      -> f
    g
    */

    eventProcessor.applyEvent({
      type: 'treenode_defineroot',
      data: {
        rootNode: {
          id: 'root',
          name: '/',
          responseData: {},
          children: []
        }
      }
    }, emptyTree())
    .then( result => {
      return eventProcessor.applyEvent(treenodeAddedEvent('root', 'a', {}), result.tree)
    }).then( (result) => {
      return eventProcessor.applyEvent(treenodeAddedEvent('a', 'b', {}), result.tree);
    }).then( result => {
      return eventProcessor.applyEvent(treenodeAddedEvent('a', 'f', {}), result.tree);
    }).then( result => {
      return eventProcessor.applyEvent(treenodeAddedEvent('b', 'c', {}), result.tree);
    }).then( result => {
      return eventProcessor.applyEvent(treenodeAddedEvent('b', 'd', {}), result.tree);
    }).then( result => {
      return eventProcessor.applyEvent(treenodeAddedEvent('d', 'e', {}), result.tree);
    }).then( result => {
      return eventProcessor.applyEvent(treenodeAddedEvent('root', 'g', {}), result.tree);
    }).then( result => {
      this.treeForMoveOperations = result.tree;
      done();
    })
  });

  it('should reject an attempt to move the root node', function(done) {
    let event = {
      type: 'treenode_moved',
      data: {
        sourceId: 'root',
        targetId: 'b'
      }
    }

    eventProcessor.applyEvent(event, this.treeForMoveOperations)
    .then( (result) => {
      fail('processor should have rejected this attempt')
    }).catch( e => {
      expect(e).toBeDefined();
      expect(e.message.indexOf('treenode_moved event cannot be applied to a root node')).toBeGreaterThan(0);
    }).finally(done);
  })

  it('should reject a treenode_moved event that is missing a sourceId property', function(done) {
    let event = {
      type: 'treenode_moved',
      data: {
        targetId: 'target'
      }
    }

    eventProcessor.applyEvent(event, this.treeForMoveOperations)
    .then( (result) => {
      fail('processor should have rejected this attempt')
    }).catch( e => {
      expect(e).toBeDefined();
      expect(e.message.indexOf('treenode_moved event is missing a required property: data.sourceId')).toBeGreaterThan(0);
    }).finally(done);
  })

  it('should reject a treenode_moved event that is missing a targetId property', function(done) {
    let event = {
      type: 'treenode_moved',
      data: {
        sourceId: 'a'
      }
    }

    eventProcessor.applyEvent(event, this.treeForMoveOperations)
    .then( (result) => {
      fail('processor should have rejected this attempt')
    }).catch( e => {
      expect(e).toBeDefined();
      expect(e.message.indexOf('treenode_moved event is missing a required property: data.targetId')).toBeGreaterThan(0);
    }).finally(done);
  })

  it('should reject a treenode_moved event that moves a node that does not exist', function(done) {
    let event = {
      type: 'treenode_moved',
      data: {
        sourceId: 10,
        targetId: 'a'
      }
    }

    eventProcessor.applyEvent(event, this.treeForMoveOperations)
    .then( (updatedTree) => {
      fail('processor should have rejected this attempt')
    }).catch( e => {
      expect(e).toBeDefined();
      expect(e.message.indexOf('Unable to move a non-existent node')).toBeGreaterThan(0);
    }).finally(done);
  })

  it('should reject a treenode_moved event that moves a node to a target that does not exist', function(done) {
    let event = {
      type: 'treenode_moved',
      data: {
        sourceId: 'a',
        targetId: 14
      }
    }

    eventProcessor.applyEvent(event, this.treeForMoveOperations)
    .then( (updatedTree) => {
      fail('processor should have rejected this attempt')
    }).catch( e => {
      expect(e).toBeDefined();
      expect(e.message.indexOf('Unable to move node to a non-existent target.')).toBeGreaterThan(0);
    }).finally(done);
  })


  it('should move a node to the root', function(done) {
    let event = {
      type: 'treenode_moved',
      data: {
        sourceId: 'f',
        targetId: 'root'
      }
    }

    eventProcessor.applyEvent(event, this.treeForMoveOperations)
    .then( (result) => {
      let updatedTree = result.tree;
      // make sure that the rootNode list has been updated
      expect(updatedTree.rootNode.children.length).toBe(3);
      let f = updatedTree.rootNode.children[2];
      expect(f.id).toBe('f');

      // assert that a only has one child left
      //console.log(updatedTree.hash['a']);
      expect(updatedTree.hash['a'].children.length).toBe(1);

      // f should have a parentId of null
      expect(f.parentId).toBe('root');
    }).catch( e => {
      fail(e);
    }).finally(done);

  })



})
