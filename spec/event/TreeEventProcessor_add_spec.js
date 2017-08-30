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

describe('TreeEventProcessor:AddNode', function() {

  beforeEach(function(done) {
    // Setup a tree with a root node
    eventProcessor.applyEvent({
      type: 'treenode_defineroot',
      data: {
        rootNode: {
          id: 'root',
          name: 'root',
          responseData: {},
          children: []
        }
      }
    }, emptyTree())
    .then( result => {
      this.tree = result.tree;
    }).catch(e => {
      console.log('error: ', e);
      fail(e);
    }).finally(done);
  })

  it('should apply a treenode_added event for the root ', function(done) {
    let addNodeEvent = treenodeAddedEvent('root', 'test-node', {});

    eventProcessor.applyEvent(addNodeEvent, this.tree)
    .then( (result) => {
      let updatedTree = result.tree;
      expect(updatedTree.rootNode.children.length).toBe(1);
      expect(updatedTree.rootNode.children[0].id).toBe('test-node');
      done();
    }).catch( e => {
      fail(e);
    })
  })

  it('should throw an error if the parentnode cannot be found', function(done) {
    let addNodeEvent = treenodeAddedEvent('bad-root', 'node', {});

    eventProcessor.applyEvent(addNodeEvent, this.tree)
    .then( result => {
      fail('expected call to throw an error');
    }).catch( e => {
      expect(e).toBeDefined();
      console.log('error: ', e);
    }).finally(done);
  })

  it('should apply two treenode_added events to the root ', function(done) {
    const nodeOneId = 'node-1';
    const nodeTwoId = 'node-2';
    let rootNodeOne = treenodeAddedEvent('root', nodeOneId, {});
    let rootNodeTwo = treenodeAddedEvent('root', nodeTwoId, {});

     eventProcessor.applyEvent(rootNodeOne, this.tree)
     .then( result => {
       return eventProcessor.applyEvent(rootNodeTwo, result.tree)
     }).then( result => {
       expect(result.tree.hash[nodeOneId]).toBeDefined();
       expect(result.tree.hash[nodeTwoId]).toBeDefined();
       expect(result.tree.rootNode.children.length).toBe(2);
       done();
     })

  })

})
