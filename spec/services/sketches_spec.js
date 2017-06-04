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
    spyOn(EventStore.prototype, 'unsubscribeAll');

    sketchService.getTree(22)
    .then( () => {
      return sketchService.getTree(33);
    }).then( () => {
      return sketchService.reset();
    }).then( () =>{
      // We can't guarantee how many sketches need to be cleared as other test cases may
      // not be cleaning up after themselves, but at least two unsubscribeAlls should be called
      expect(EventStore.prototype.unsubscribeAll.calls.count()).not.toBeLessThan(2);
      //expect(EventStore.prototype.unsubscribeAll).toHaveBeenCalledTimes(2);
    }).catch(e => { fail(e);}).then(done);
  })
})


describe('/services/sketches.js ', function() {

  beforeEach(function(done) {
    this.sketchId = 10;
    this.userId = 99;

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
      fullpath: fullpath
    }
  }


  describe('addNode', function() {

    it('should add a root node to a sketch tree', function(done) {
      winston.log('info', 'should add a root node to a sketch tree');
      let newNode = createEmptyNode('root_test', '/api/root_test');

      sketchService.addTreeNode(this.userId, this.sketchId, newNode, null, 'test1')
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
      sketchService.addTreeNode(this.userId, this.sketchId, parentNode, null, 'add_child_test(parent)')
      .then( result => {
        expect(result.nodeId).toBeDefined();
        expect(result.tree.rootNodes[0].name).toBe(parentNode.name);
        let parentNodeId = result.nodeId;
        return sketchService.addTreeNode(this.userId, this.sketchId, childNode, parentNodeId, 'add_child_test(child)')
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

      sketchService.addTreeNode(this.userId, this.sketchId, childNode, badParentNodeId, 'add_bad_child')
      .then( (result) => {
        fail('addTreeNode should have rejected this operation');
      }).catch( e => {
        expect(e).toBeDefined();
      }).finally(done)
    })
  })

  describe('getTree', function() {

    beforeEach(function(done){
      this.node1 = createEmptyNode('name1', '/name1');
      this.node2 = createEmptyNode('name2', '/name2');

      // Generate a tree
      sketchService.addTreeNode(this.userId, this.sketchId, this.node1).then( result => {
        this.node1.id = result.nodeId;
      }).finally(done);
    })

    it('should return a cached copy of a sketch tree', function(done) {
      sketchService.getTree(this.sketchId).then(
      result => {
        expect(result.tree).toBeDefined();
        expect(result.tree.rootNodes.length).toBe(1);
        expect(result.tree.rootNodes[0].name).toBe(this.node1.name);
      }).catch( e=> {
        fail(e);
      }).finally(done);
    });

    it('should return a sketch tree filled with historical events', function(done) {

      // Add a few more events to the sketch
      let child1 = createEmptyNode('child1', '/child1');
      let child2 = createEmptyNode('child2', '/child2');
      let grandchild1 = createEmptyNode('gc1', '/gc1');

      sketchService.addTreeNode(this.userId, this.sketchId, child1, this.node1.id)
      .then( result => {
        return sketchService.addTreeNode(this.userId, this.sketchId, grandchild1, result.nodeId);
      }).then( result => {
        return sketchService.addTreeNode(this.userId, this.sketchId, child2, this.node1.id);
      }).then( result => {
          // Flush the cache so that the tree needs to be rebuilt
          return sketchService.reset();
      }).then( result => {
          // Make sure the tree is populated
          return sketchService.getTree(this.sketchId);
      }).then( result => {
        winston.log('debug', result.tree)
        expect(result.tree.rootNodes.length).toBe(1);
        expect(result.tree.rootNodes[0].children.length).toBe(2);
        expect(result.tree.rootNodes[0].children[0].name).toBe('child1');
        expect(result.tree.rootNodes[0].children[0].children[0].name).toBe('gc1')
      }).catch( e => {fail(e);}).finally(done);
    });

    it('should wait for all historical events to be applied before returning a result', function(done) {

      // Get the last event ID
      sketchService.getEventStore().getLastEventID(this.sketchId)
      .then( lastEventID => {

        const nextEventId = lastEventID ? lastEventID + 1 : 1;

        // Need to mock the Event Store to simulate a situation in which getTree
        // must wait for events to finish processing.
        spyOn(sketchService.getEventStore(), 'getLastEventID').and.callFake( ()=>{
          return new Promise( (resolve,reject) => {
            resolve(nextEventId);
          });
        })

        let nodeId = 'node-id';

        sketchService.getTree(this.sketchId)
        .then(result => {
          // getTree should not resolve until we push an event with id 2
          expect(result.tree.hash[nodeId]).toBeDefined();
          expect(result.tree.hash[nodeId].name).toBe('1388-name');
        }).catch(e => {fail(e)}).finally(done);

        winston.log('debug', 'Pushing fake event into event store');
        // Push events
        sketchService.getEventStore().push(this.userId, this.sketchId,
          'treenode_added',
          {
            id: 300,
            node: {
              id: nodeId,
              name: '1388-name',
              fullpath: '/testing'
            }
        });
      })
    })
  })

  describe('updateNode', function() {

    beforeEach(function(done){
      this.originalNode = createEmptyNode('original', '/original');
      this.originalChildNode = createEmptyNode('original_child', '/original_child');

      // Generate a tree
      sketchService.addTreeNode(this.userId, this.sketchId, this.originalNode)
      .then( (result) => {
        this.originalNode.id = result.nodeId;
        return sketchService.addTreeNode(this.userId, this.sketchId, this.originalChildNode, result.nodeId)
      }).then( result => {
        this.originalChildNode.id = result.nodeId;
      }).finally(done);
    })

    it('should update the message data of an existing CRUD node', function(done) {

      let updateObject = {
        key: 'put',
        fields: {
          contentType: 'some/crazytype',
          enabled: true,
          queryParams: '?name=val',
          requestBody: '{}',
          responseBody: 'blahblahblah123'
        }
      }

      sketchService.updateBodyData(this.userId, this.sketchId, this.originalNode.id, updateObject)
      .then( (result) => {
        let putData = result.tree.rootNodes[0].data.put;
        expect(putData.queryParams).toBe(updateObject.fields.queryParams);
        expect(putData.requestBody).toBe(updateObject.fields.requestBody);
        expect(putData.responseBody).toBe(updateObject.fields.responseBody);
      }).catch( (error) => {
        fail(error);
      }).finally(done);
    })

    it('should reject an attempt to update a CRUD node that does not exist', function(done) {

      // Add a root node
      sketchService.updateBodyData(this.userId, this.sketchId, 300, {})
      .then( () => {
        fail('the update call should have failed');
      }).catch( e => {
        expect(e).toBeDefined();
        //console.log(e);
        expect(e.message.startsWith('Cannot update response data for non-existent node')).toBe(true);
      }).finally(done);
    })

    it('should update a selected property of an existing CRUD node', function(done) {

      const updateObject = {
        nodeId: this.originalNode.id,
        fields: {
          fullpath: 'newPath'
        }
      }

      // First add a root node
      sketchService.updateNodeDetails(this.userId, this.sketchId, this.originalNode.id, updateObject)
      .then( result => {
        expect(result.tree.rootNodes[0].fullpath).not.toBe(this.originalNode.fullpath);
        expect(result.tree.rootNodes[0].fullpath).toBe('newPath');
      }).catch( e => { fail(e); }).finally(done);
    })

    it('should apply update events sequentially', function(done) {
      let childNode = createEmptyNode('child', '/child');

      const updateObject = { nodeId: this.originalNode.id, fields: { fullpath: '1' } };
      const updateObject2 = { nodeId: this.originalNode.id, fields: { fullpath: '2' } };
      const updateObject3 = { nodeId: this.originalNode.id, fields: { fullpath: '3' } };

      sketchService.updateNodeDetails(this.userId, this.sketchId, this.originalNode.id, updateObject)
      sketchService.updateNodeDetails(this.userId, this.sketchId, this.originalNode.id, updateObject2)
      sketchService.updateNodeDetails(this.userId, this.sketchId, this.originalNode.id, updateObject3)
      .then(() => {
        winston.log('debug', 'Trying to get tree');
        return sketchService.getTree( this.sketchId )
      }).then( result => {
        expect(result.tree.rootNodes[0].fullpath).toBe(updateObject3.fields.fullpath);
      }).catch( e=> {fail(e)}).then(done)
    })
  })

  describe('move node', function() {

    beforeEach(function(done){
      this.nodeA = createEmptyNode('a', '/a');
      this.nodeB = createEmptyNode('b', '/b');
      this.nodeC = createEmptyNode('c', '/c');
      this.nodeD = createEmptyNode('d', '/d');

      // Generate a tree
      sketchService.addTreeNode(this.userId, this.sketchId, this.nodeA)
      .then( result => {
        this.nodeA.id = result.nodeId;
        return sketchService.addTreeNode(this.userId, this.sketchId, this.nodeB, this.nodeA.id);
      }).then( result => {
        this.nodeB.id = result.nodeId;
        return sketchService.addTreeNode(this.userId, this.sketchId, this.nodeC, this.nodeB.id);
      }).then( result => {
        this.nodeC.id = result.nodeId;
        return sketchService.addTreeNode(this.userId, this.sketchId, this.nodeD);
      }).then( result => {
        this.nodeD.id = result.nodeId;
      }).finally(done);

    })

    it('should reject an atempt to move a node when the source id is not defined', function(done) {
      sketchService.moveNode(this.userId, this.sketchId)
      .then( () => {
        fail('this call should have failed');
      }).catch( e => {
        expect(e).toBeDefined();
        expect(e.message.startsWith('Cannot move undefined node')).toBe(true);
      }).finally(done);
    })

    it('should reject an attempt to move a node to a non-existent parent', function(done) {
      sketchService.moveNode(this.userId, this.sketchId, this.nodeB.id, 'bad-id' )
      .then( () => {
        fail('this call should have failed');
      }).catch( e => {
        expect(e).toBeDefined();
        expect(e.message.startsWith('Cannot move node to non-existent target node with ID:')).toBe(true);
      }).finally(done);
    })

    it('should reject an attempt to make a circular tree', function(done) {
      sketchService.moveNode(this.userId, this.sketchId, this.nodeA.id, this.nodeC.id)
      .then( () => {
        fail('circular move should have failed.');
      }).catch( e => {
        expect(e).toBeDefined();
        expect(e.message).toBe('Unable to move node because it would result in a circular tree.');
      }).finally(done);
    });

    it('should apply a node move event', function(done) {
      // Move node b to node d
      sketchService.moveNode(this.userId, this.sketchId, this.nodeB.id, this.nodeD.id)
      .then(() => {
        winston.log('debug', 'Trying to get tree');
        return sketchService.getTree( this.sketchId )
      }).then( result => {
        expect(result.tree.hash[this.nodeA.id].children.length).toBe(0);
        expect(result.tree.hash[this.nodeD.id].children.length).toBe(1);
        expect(result.tree.hash[this.nodeD.id].children[0].id).toBe(this.nodeB.id);
      }).catch( e=> {fail(e)}).then(done)
    });
  })

  describe('general tests', function() {

    it('should populate three sketch cache without conflict', function(done) {
      let sketch1 = 10;
      let sketch2 = 20;
      let sketch3 = 30;

      let node1 = createEmptyNode('node1', '/node1');
      let node2 = createEmptyNode('node2', '/node2');
      let node3 = createEmptyNode('node3', '/node3');

      sketchService.getTree(sketch1)
      .then( result => {
        return sketchService.addTreeNode(this.userId, sketch2, node1);
      }).then( result => {
        return sketchService.addTreeNode(this.userId, sketch3, node2);
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
