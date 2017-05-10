"use strict";

const sketchService = require('../../src/services/sketches.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const winston = require('winston');
const uuidV4 = require('uuid/v4');
const EventStore = require('../../src/event/EventStore.js');
const SketchEventStream = require('../../src/event/SketchEventStream.js');
const dataAccessor = require('../../src/db/DataAccessor.js');

describe('Sketch service reset', function() {
  it('should remove a listener when reset() is called', function(done){
    let sketchId = 14;
    sketchService.getTree(sketchId)
    .then( () => {
      sketchService.reset();
    }).catch(e => { fail(e);}).then(done);
  })
})


describe('/services/sketches.js ', function() {

  beforeEach(function(done) {
    // remove the event history before each test
    const db = dataAccessor.getDb();
    db.query('delete from sketchevents;')
    .then( () => {
      // Flush all subscribers
      return sketchService.reset();
    }).finally(done);


  })

  let createEmptyNode = function(name, fullpath) {
    return {
      name: name,
      fullpath: fullpath,
      responseData: {}
    }
  }


  describe('addNode', function() {
    let sketchId = 1;

    it('should add a root node to a sketch tree', function(done) {
      winston.log('info', 'should add a root node to a sketch tree');
      let newNode = createEmptyNode('root_test', '/api/root_test');

      sketchService.addTreeNode(sketchId, newNode, null, 'test1')
      .then( (result) => {
        expect(result).toBeDefined();
        expect(result.nodeId).toBeDefined();
        expect(result.tree).toBeDefined();
        expect(result.tree).not.toBeNull();
        expect(result.tree.rootNodes[0].name).toBe(newNode.name);
      }).catch( e => {
        fail(e);
      }).finally(done)
    });

    it('should add a child node to an existing node', function(done) {
      winston.log('info', 'should add a child node to an existing node');
      let parentNode = createEmptyNode('parent', '/parent');
      let childNode = createEmptyNode('child', '/child');
      sketchService.addTreeNode(sketchId, parentNode, null, 'add_child_test(parent)')
      .then( result => {
        expect(result.nodeId).toBeDefined();
        expect(result.tree.rootNodes[0].name).toBe(parentNode.name);
        let parentNodeId = result.nodeId;
        return sketchService.addTreeNode(sketchId, childNode, parentNodeId, 'add_child_test(child)')
      }).then( result => {
        expect(result.nodeId).toBeDefined();
        expect(result.tree.rootNodes.length).toBe(1);
        let parentNode = result.tree.rootNodes[0];
        expect(parentNode.children.length).toBe(1);
        expect(parentNode.children[0].name).toBe(childNode.name);
        done();
      })
    })

    it('should reject an attempt to add a child to a parent that does not exist', function(done) {
      let childNode = createEmptyNode('child', '/child');
      let badParentNodeId = 99;

      sketchService.addTreeNode(sketchId, childNode, badParentNodeId, 'add_bad_child')
      .then( (result) => {
        fail('addTreeNode should have rejected this operation');
      }).catch( e => {
        expect(e).toBeDefined();
      }).finally(done)
    })


  })

  describe('getTree', function() {
    let node1 = createEmptyNode('name1', '/name1');
    let node2 = createEmptyNode('name1', '/name1');
    let sketchId = 10;

    beforeEach(function(done){
      // Generate a tree
      sketchService.addTreeNode(sketchId, node1).then( result => {
        node1.id = result.nodeId;
      }).finally(done);
    })

    it('should return a cached copy of a sketch tree', function(done) {
      sketchService.getTree(sketchId).then(
      result => {
        expect(result.tree).toBeDefined();
        expect(result.tree.rootNodes.length).toBe(1);
        expect(result.tree.rootNodes[0].name).toBe(node1.name);
      }).catch( e=> {
        fail(e);
      }).finally(done);
    });

    it('should return a sketch tree filled with historical events', function(done) {
      // Add a few more events to the sketch
      let child1 = createEmptyNode('child1', '/child1');
      let child2 = createEmptyNode('child2', '/child2');
      let grandchild1 = createEmptyNode('gc1', '/gc1');

      sketchService.addTreeNode(sketchId, child1, node1.id)
      .then( result => {
        return sketchService.addTreeNode(sketchId, grandchild1, result.nodeId);
      }).then( result => {
        return sketchService.addTreeNode(sketchId, child2, node1.id);
      }).then( result => {
          // Flush the cache so that the tree needs to be rebuilt
          return sketchService.reset();
      }).then( result => {
          // Make sure the tree is populated
          return sketchService.getTree(sketchId);
      }).then( result => {
        winston.log('debug', result.tree)
        expect(result.tree.rootNodes.length).toBe(1);
        expect(result.tree.rootNodes[0].children.length).toBe(2);
        expect(result.tree.rootNodes[0].children[0].name).toBe('child1');
        expect(result.tree.rootNodes[0].children[0].children[0].name).toBe('gc1')
      }).catch( e => {fail(e);}).finally(done);
    });

    fit('should wait for all historical events to be applied before returning a result', function(done) {
      // Need to mock the Event Store to simulate a situation in which getTree
      // must wait for events to finish processing.
      spyOn(sketchService.getEventStore(), 'getLastEventID').and.callFake( ()=>{
        return new Promise( (resolve,reject) => {
          resolve(2);
        });
      })

      let nodeId = 'node-id';

      sketchService.getTree(sketchId)
      .then(result => {
        // getTree should not resolve until we push an event with id 2
        expect(result.tree.hash[nodeId]).toBeDefined();
      }).catch(e => {fail(e)}).finally(done);

      // Push events
      sketchService.getEventStore().push(sketchId,
        'treenode_added',
        {
          id: 2,
          node: {
            id: nodeId,
            name: 'testing',
            fullpath: '/testing'
          }
        });
      })
    })

  describe('updateNode', function() {
    let sketchId = 10;
    let originalNode = createEmptyNode('original', '/original');
    let originalChildNode = createEmptyNode('original_child', '/original_child');

    beforeEach(function(done){
      // Generate a tree
      sketchService.addTreeNode(sketchId, originalNode)
      .then( (result) => {
        originalNode.id = result.nodeId;
        return sketchService.addTreeNode(sketchId, originalChildNode, result.nodeId)
      }).then( result => {
        originalChildNode.id = result.nodeId;
      }).finally(done);
    })

    it('should update the responseData for an existing CRUD node', function(done) {

      let updateObject = {
        key: 'put',
        fields: {
          contentType: 'some/crazytype',
          enabled: true,
          body: 'blahblahblah123'
        }
      }

      sketchService.updateResponseData(sketchId, originalNode.id, updateObject)
      .then( (result) => {
        expect(result.tree.rootNodes[0].responseData).toBeDefined();
      }).catch( (error) => {
        fail(error);
      }).finally(done);
    })

    it('should reject an attempt to update a CRUD node that does not exist', function(done) {

      // Add a root node
      sketchService.updateResponseData(sketchId, 300, {})
      .then( () => {
        fail('the update call should have failed');
      }).catch( e => {
        expect(e).toBeDefined();
        expect(e.startsWith('Cannot update response data for non-existent node')).toBe(true);
      }).finally(done);

    })

    it('should update a selected property of an existing CRUD node', function(done) {

      const updateObject = {
        nodeId: originalNode.id,
        fields: {
          fullpath: 'newPath'
        }
      }

      // First add a root node
      sketchService.updateNodeDetails(sketchId, originalNode.id, updateObject)
      .then( result => {
        expect(result.tree.rootNodes[0].fullpath).not.toBe(originalNode.fullpath);
        expect(result.tree.rootNodes[0].fullpath).toBe('newPath');
      }).catch( e => { fail(e); }).finally(done);

    })


    it('should apply update events sequentially', function(done) {
      let childNode = createEmptyNode('child', '/child');

      const updateObject = { nodeId: originalNode.id, fields: { fullpath: '1' } };
      const updateObject2 = { nodeId: originalNode.id, fields: { fullpath: '2' } };
      const updateObject3 = { nodeId: originalNode.id, fields: { fullpath: '3' } };

      sketchService.updateNodeDetails(sketchId, originalNode.id, updateObject)
      sketchService.updateNodeDetails(sketchId, originalNode.id, updateObject2)
      sketchService.updateNodeDetails(sketchId, originalNode.id, updateObject3)
      .then(() => {
        winston.log('debug', 'Trying to get tree');
        return sketchService.getTree( sketchId )
      }).then( result => {
        expect(result.tree.rootNodes[0].fullpath).toBe(updateObject3.fields.fullpath);
      }).catch( e=> {fail(e)}).then(done)
    })

  })

  describe('general tests', function() {

    let sketchId = 11;

      it('should populate three sketch cache without conflict', function(done) {
        let sketch1 = 10;
        let sketch2 = 20;
        let sketch3 = 30;

        let node1 = createEmptyNode('node1', '/node1');
        let node2 = createEmptyNode('node2', '/node2');
        let node3 = createEmptyNode('node3', '/node3');

        sketchService.getTree(sketch1)
        .then( result => {
          return sketchService.addTreeNode(sketch2, node1);
        }).then( result => {
          return sketchService.addTreeNode(sketch3, node2);
        }).then( result => {
          return sketchService.getTree(sketch1)
        }).then( result => {
          expect(result.tree.rootNodes.length).toBe(0);
          return sketchService.getTree(sketch2)
        }).then( result => {
          expect(result.tree.rootNodes.length).toBe(1);
        }).catch( e => {fail(e)}).finally(done);

      })



  })

});
