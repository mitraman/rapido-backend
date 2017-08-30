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

let findNode = function(node, nodeId) {
  if( nodeId === node.id) {
    return true;
  }
  for( var i = 0; i < node.children.length; i++ ) {
    if( findNode(node.children[i]) ) {
      return true;
    }
  }
  return false;
}

describe('TreeEventProcessor:DeleteNode', function() {

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
      this.treeForDeleteOperations = result.tree;
      done();
    })
  });

  it('should reject a treenode_deleted event that is missing a nodeId property', function(done) {
    let event = {
      type: 'treenode_deleted',
      data: {
      }
    }

    eventProcessor.applyEvent(event, this.treeForDeleteOperations)
    .then( (result) => {
      fail('unexpected success');
    }).catch( e => {
      expect(e).toBeDefined();
      expect(e.message.indexOf('treenode_deleted event is missing a required property: data.nodeId')).toBeGreaterThan(0);
    }).finally(done);

  })

  it('should reject a treenode_deleted event that targets a non-existent node', function(done) {
    let event = {
      type: 'treenode_deleted',
      data: {
        nodeId: 'non-existent'
      }
    }

    eventProcessor.applyEvent(event, this.treeForDeleteOperations)
    .then( (result) => {
      fail('unexpected success');
    }).catch( e => {
      expect(e).toBeDefined();
      expect(e.message.indexOf('Unable to delete a non-existent node')).toBeGreaterThan(0);
    }).finally(done);
  })

  it('should reject an attempt to delete the root node', function(done) {
    let event = {
      type: 'treenode_deleted',
      data: {
        nodeId: 'root'
      }
    };

    eventProcessor.applyEvent(event, this.treeForDeleteOperations)
    .then( result => {
      fail('test case should have failed');
    }).catch( e => {
      expect(e).toBeDefined();
      expect(e.message.indexOf('treenode_deleted events cannot be applied to root nodes.')).toBeGreaterThan(0);
    }).finally(done);
  })

  it('should delete a tree node that has no children', function(done) {
    let event = {
      type: 'treenode_deleted',
      data: {
        nodeId: 'e'
      }
    }

    eventProcessor.applyEvent(event, this.treeForDeleteOperations)
    .then( (result) => {
      let updatedTree = result.tree;
      expect(updatedTree.rootNode.children.length).toBe(2);
      expect(findNode(updatedTree.rootNode, 'e')).toBe(false);
      expect(updatedTree.hash['e']).not.toBeDefined();
    }).catch( e => {
      fail(e);
    }).finally(done);
  })

  it('should add a deleted node to the deleted collection of a tree ', function(done) {
    let event = {
      type: 'treenode_deleted',
      data: {
        nodeId: 'e'
      }
    }

    eventProcessor.applyEvent(event, this.treeForDeleteOperations)
    .then( (result) => {
      let updatedTree = result.tree;
      expect(updatedTree.deletedNodes['e']).toBeDefined();
    }).catch( e => {
      fail(e);
    }).finally(done);
  })

  it('should remove a subtree if the target node has children', function(done) {
    let event = {
      type: 'treenode_deleted',
      data: {
        nodeId: 'b'
      }
    }

    eventProcessor.applyEvent(event, this.treeForDeleteOperations)
    .then( (result) => {
      let updatedTree = result.tree;
      expect(findNode(updatedTree.rootNode, 'b')).toBe(false);
      expect(updatedTree.hash['b']).not.toBeDefined();
      expect(findNode(updatedTree.rootNode, 'c')).toBe(false);
      expect(updatedTree.hash['c']).not.toBeDefined();
      expect(findNode(updatedTree.rootNode, 'd')).toBe(false);
      expect(updatedTree.hash['d']).not.toBeDefined();
      expect(findNode(updatedTree.rootNode, 'e')).toBe(false);
      expect(updatedTree.hash['e']).not.toBeDefined();
    }).catch( e => {
      fail(e);
    }).finally(done);
  });

})
