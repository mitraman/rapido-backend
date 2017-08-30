"use strict";

const winston = require('winston');
const Promise = require('bluebird');
const eventProcessor = require('../../src/event/EventProcessor.js');

let emptyTree = function() {
  return {
    hash: {},
    rootNode: null,
    deletedNodes: {}
  };
};

describe('TreeEventProcessor:defineroot', function() {

  it('should apply a treenode_defineroot event for a new tree', function(done) {
    let event = {
      type: 'treenode_defineroot',
      data: {
        rootNode: {
          id: 'root-node',
          name: 'root-node',
          responseData : {},
          children: []
        }
      }
    }

    eventProcessor.applyEvent(event, emptyTree())
    .then( (result) => {
      let updatedTree = result.tree;
      expect(updatedTree.rootNode).toBeDefined();
      expect(updatedTree.rootNode.id).toBe('root-node');
      expect(updatedTree.rootNode.name).toBe('root-node');
      expect(updatedTree.rootNode.type).toBe('root');
      expect(updatedTree.rootNode.parentId).toBeUndefined();
      done();
    }).catch( e => {
      fail(e);
    }).finally(done);
  })

  it('should apply a treenode_defineroot event when a root is already defined', function(done) {
    let event = {
      type: 'treenode_defineroot',
      data: {
        rootNode: {
          id: 'root-node',
          name: 'root-node',
          responseData : {},
          children: []
        }
      }
    }

    let tree = emptyTree();

    eventProcessor.applyEvent(event, tree)
    .then( (result) => {
      let updatedTree = result.tree;
      expect(updatedTree.rootNode.id).toBe('root-node');
      return eventProcessor.applyEvent(
        {
          type: 'treenode_defineroot',
          data: {
            rootNode: {
              id: 'new-root-node',
              name: 'root-node',
              responseData: {},
              children: []
            }
          }
        }, updatedTree);
    }).then( result => {
      expect(result.tree.rootNode.id).toBe('new-root-node');
    }).catch( e => {
      fail(e);
    }).finally(done);

  })

})
