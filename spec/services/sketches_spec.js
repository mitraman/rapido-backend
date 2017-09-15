"use strict";

const sketchService = require('../../src/services/sketches.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const winston = require('winston');
const uuidV4 = require('uuid/v4');
const Promise = require('bluebird');
const EventStore = require('../../src/event/EventStore.js');
const EventSubscription = require('../../src/event/EventSubscription.js')
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
      name: name
    }
  }

  describe('createRoot', function() {
    it('should create and set the root node for a tree', function(done) {
      sketchService.createRootNode(this.userId, this.sketchId, { name: '/'})
      .then( result => {
        expect(result.tree).toBeDefined();
        expect(result.tree.rootNode).toBeDefined();
        expect(result.tree.rootNode.id).toBeDefined();
        expect(result.tree.rootNode.name).toBe('/');
        expect(result.tree.rootNode.fullpath).toBe('/');
      }).catch( e => {
        fail(e);
      }).finally(done);
    })

    //TODO: Currently only getTree applies historical events to the tree
    // All sketch operations should do that.
    xit('should apply historical events before setting the root node', function(done) {
      fail('to be implemented.');
    })
  })

  describe('subscription management', function() {

    it('should set a ttl for event subscriptions', function(done) {

      let subscriber;

      spyOn(sketchService.getCache(), 'get').and.callFake(key => {
        return new Promise( (resolve,reject) => {
          resolve(subscriber)
        });
      })

      spyOn(sketchService.getCache(), 'set').and.callFake( (key, value, ttl) => {
        expect(key).toBe(10);
        expect(ttl).toBeDefined();
        done();
      })

      // Make a call to load a tree into memory
      sketchService.getTree(10);
    })

    it('should extend the timeout period when any sketch call is made', function(done) {
      let subscriber;

      spyOn(sketchService.getCache(), 'get').and.callFake(key => {
        return new Promise( (resolve,reject) => {
          resolve(subscriber)
        });
      })

      spyOn(sketchService.getCache(), 'set').and.callFake( (key, value, ttl) => {
        expect(key).toBe(10);
        expect(ttl).toBeDefined();
        if( key === 10) {
          subscriber = value;
        }
      })

      spyOn(sketchService.getCache(), 'ttl').and.callFake( (key, ttl) => {
        expect(key).toBe(10);
        expect(ttl).toBeDefined();
      })

      // Make a call to load a tree into memory
      sketchService.getTree(10)
      .then( result => {
        // Make another call and expect the cache TTL to be extended
        console.log('making second call');
        return sketchService.getTree(10);
      }).then( result => {
        expect(sketchService.getCache().ttl.calls.count()).toBe(1);
      }).catch( e => {
        fail(e);
      }).finally(done);
    })
  })

  describe('addNode', function() {

    beforeEach(function(done) {
      sketchService.createRootNode(this.userId, this.sketchId, { name: '/'})
      .then( result => {
        this.rootId = result.tree.rootNode.id;
      }).catch( e=> {
        console.log(e);
        fail(e);
      }).finally(done);
    })

    it('should add a node to a sketch tree root', function(done) {
      winston.log('info', 'should add a node to a sketch tree root');
      let newNode = {
        name: 'newNode'
      };

      sketchService.addTreeNode(this.userId, this.sketchId, newNode, this.rootId)
      .then( (result) => {
        expect(result).toBeDefined();
        expect(result.nodeId).toBeDefined();
        expect(result.tree).toBeDefined();
        expect(result.tree).not.toBeNull();
        expect(result.tree.rootNode.children[0].name).toBe('newNode');
      }).catch( e => {
        fail(e);
      }).finally(done)
    });

    it('should add a node to a sketch tree root with the expected properties', function(done) {
      let name = 'name-test';
      let path = '/name-test';
      let newNode = {
        name: 'name-test',
        data: {}
      }

      sketchService.addTreeNode(this.userId, this.sketchId, newNode, this.rootId)
      .then( (result) => {
        expect(result).toBeDefined();
        let node = result.tree.hash[result.nodeId];
        //console.log(node);
        expect(node.id).toBe(result.nodeId);
        expect(node.name).toBe(name);
        expect(node.fullpath).toBe('/' + name);
        expect(node.children).toEqual([]);
        expect(node.data).toEqual({})
      }).catch( e => {
        fail(e);
      }).finally(done)
    })

    it('should add a child node to a non-root node', function(done) {
      winston.log('info', 'should add a child node to an existing node');
      let parentNode = createEmptyNode('parent');
      let childNode = createEmptyNode('child');
      sketchService.addTreeNode(this.userId, this.sketchId, parentNode, this.rootId)
      .then( result => {
        expect(result.nodeId).toBeDefined();
        expect(result.tree.rootNode.children[0].name).toBe(parentNode.name);
        let parentNodeId = result.nodeId;
        return sketchService.addTreeNode(this.userId, this.sketchId, childNode, parentNodeId)
      }).then( result => {
        expect(result.nodeId).toBeDefined();
        expect(result.tree.rootNode.children.length).toBe(1);
        let parentNode = result.tree.rootNode.children[0];
        expect(parentNode.children.length).toBe(1);
        expect(parentNode.children[0].name).toBe(childNode.name);
        done();
      })
    })

    it('should set the correct path properties for a child node', function(done){
      winston.log('info', 'should add a child node to an existing node');
      let parentNode = createEmptyNode('parent');
      let childNode = createEmptyNode('child');
      let gcNode = createEmptyNode('gc');
      sketchService.addTreeNode(this.userId, this.sketchId, parentNode, this.rootId)
      .then( result => {
        let parentNodeId = result.nodeId;
        return sketchService.addTreeNode(this.userId, this.sketchId, childNode, parentNodeId);
      }).then( result => {
        let childNodeId = result.nodeId;
        return sketchService.addTreeNode(this.userId, this.sketchId, gcNode, childNodeId);
      }).then( result => {
        let node = result.tree.hash[result.nodeId];
        expect(node.name).toBe(gcNode.name);
        expect(node.fullpath).toBe('/' + parentNode.name + '/' + childNode.name + '/' + gcNode.name);
        done();
      })
    });

    it('should reject an attempt to add a child to a parent that does not exist', function(done) {
      let childNode = createEmptyNode('child');
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

      sketchService.createRootNode(this.userId, this.sketchId, { name: '/'})
      .then( result => {
        this.rootId = result.tree.rootNode.id;
        return sketchService.addTreeNode(this.userId, this.sketchId, this.node1, this.rootId)
      }).then( result => {
          this.node1.id = result.nodeId;
      }).catch( e=> {
        console.log(e);
        fail(e);
      }).finally(done);
    })

    it('should return two sketches when called in parallel', function(done) {
      let newRootId;
      // Create a second sketch
      sketchService.createRootNode(this.userId, this.sketchId+1, { name: '/'})
      .then( result => {
        newRootId = result.tree.rootNode.id;
        expect(this.rootId).not.toEqual(newRootId);

        // Try just retrieving the first one
        return sketchService.getTree(this.sketchId);
      }).then( result => {
        expect(result.tree.rootNode.id).toEqual(this.rootId);

        // Try just retrieving the seond one
        return sketchService.getTree(this.sketchId+1);
      }).then( result => {
        expect(result.tree.rootNode.id).toEqual(newRootId);

        // Now, try both at the same time
        let getTreePromises = [];

        // Load up two getTree promises to be fired at the same time
        getTreePromises.push(sketchService.getTree(this.sketchId));
        getTreePromises.push(sketchService.getTree(this.sketchId+1));

        // Fire the promises
  			return Promise.all(getTreePromises);
      }).then( result => {
        console.log(result[0].tree.rootNode);
        console.log(result[1].tree.rootNode);
        expect(result[0].tree.rootNode.id).not.toEqual(result[1].tree.rootNode.id);
        done();
      })
    })

    it('should return a copy fo the tree even if historical events cannot be applied', function(done) {
      fail('to be implemented');
    })

    it('should return a cached copy of a sketch tree', function(done) {
      sketchService.getTree(this.sketchId).then(
      result => {
        expect(result.tree).toBeDefined();
        expect(result.tree.rootNode.children.length).toBe(1);
        expect(result.tree.rootNode.children[0].name).toBe(this.node1.name);
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
        expect(result.tree.rootNode.children.length).toBe(1);
        expect(result.tree.rootNode.children[0].children.length).toBe(2);
        expect(result.tree.rootNode.children[0].children[0].name).toBe('child1');
        expect(result.tree.rootNode.children[0].children[0].children[0].name).toBe('gc1')
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
            parentId: this.rootId,
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
      sketchService.createRootNode(this.userId, this.sketchId, { name: '/'})
      .then( result => {
        this.rootId = result.tree.rootNode.id;
        return sketchService.addTreeNode(this.userId, this.sketchId, this.originalNode, this.rootId);
      }).then( (result) => {
        this.originalNode.id = result.nodeId;
        return sketchService.addTreeNode(this.userId, this.sketchId, this.originalChildNode, result.nodeId)
      }).then( result => {
        this.originalChildNode.id = result.nodeId;
      }).finally(done);
    })

    it('should update the fullpath of the target node and all descendants on a name change', function(done) {
      const updateObject = {
        nodeId: this.originalNode.id,
        fields: {
          name: 'newName'
        }
      }

      sketchService.updateNodeDetails(this.userId, this.sketchId, this.originalNode.id, updateObject)
      .then( result => {
        expect(result.tree.rootNode.children[0].fullpath).not.toBe(this.originalNode.fullpath);
        expect(result.tree.rootNode.children[0].fullpath).toBe('/newName');
        expect(result.tree.rootNode.children[0].children[0].fullpath).toBe('/newName/' + this.originalChildNode.name);
      }).catch( e => { fail(e); }).finally(done);
    })

    it('should update the message data of an existing CRUD node', function(done) {

      let updateObject = {
        key: 'put',
        fields: {
          enabled: true,
          request: {
            contentType: 'some/crazytype',
            queryParams: '?name=val',
            body: '{}'
          },
          response: {
            status: '200',
            contentType: 'some/crazytype',
            body: 'blahblahblah123'
          }
        }
      }

      sketchService.updateBodyData(this.userId, this.sketchId, this.originalNode.id, updateObject)
      .then( (result) => {
        let putData = result.tree.rootNode.children[0].data.put;
        expect(putData.request.queryParams).toBe(updateObject.fields.request.queryParams);
        expect(putData.request.body).toBe(updateObject.fields.request.body);
        expect(putData.response.body).toBe(updateObject.fields.response.body);
        expect(putData.response.status).toBe(updateObject.fields.response.status);
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
        expect(e.code).toBe(RapidoErrorCodes.fieldValidationError);
        expect(e.fieldErrors[0].field).toBe('nodeId');
        expect(e.fieldErrors[0].type).toBe('invalid');
      }).finally(done);
    })

    it('should update a selected property of an existing CRUD node', function(done) {

      const updateObject = {
        nodeId: this.originalNode.id,
        fields: {
          name: 'newName'
        }
      }

      sketchService.updateNodeDetails(this.userId, this.sketchId, this.originalNode.id, updateObject)
      .then( result => {
        expect(result.tree.rootNode.children[0].name).not.toBe(this.originalNode.name);
        expect(result.tree.rootNode.children[0].name).toBe('newName');
      }).catch( e => { fail(e); }).finally(done);
    })

    it('should apply update events sequentially', function(done) {
      let childNode = createEmptyNode('child', '/child');

      const updateObject = { nodeId: this.originalNode.id, fields: { name: '1' } };
      const updateObject2 = { nodeId: this.originalNode.id, fields: { name: '2' } };
      const updateObject3 = { nodeId: this.originalNode.id, fields: { name: '3' } };

      sketchService.updateNodeDetails(this.userId, this.sketchId, this.originalNode.id, updateObject)
      sketchService.updateNodeDetails(this.userId, this.sketchId, this.originalNode.id, updateObject2)
      sketchService.updateNodeDetails(this.userId, this.sketchId, this.originalNode.id, updateObject3)
      .then(() => {
        winston.log('debug', 'Trying to get tree');
        return sketchService.getTree( this.sketchId )
      }).then( result => {
        expect(result.tree.rootNode.children[0].name).toBe(updateObject3.fields.name);
      }).catch( e=> {fail(e)}).then(done)
    })
  })

  describe('move node', function() {

    beforeEach(function(done){
      this.nodeA = createEmptyNode('a');
      this.nodeB = createEmptyNode('b');
      this.nodeC = createEmptyNode('c');
      this.nodeD = createEmptyNode('d');

      // Generate a tree
      sketchService.createRootNode(this.userId, this.sketchId, { name: '/'})
      .then( result => {
        this.rootId = result.tree.rootNode.id;
        return sketchService.addTreeNode(this.userId, this.sketchId, this.nodeA, this.rootId);
      }).then( result => {
        this.nodeA.id = result.nodeId;
        return sketchService.addTreeNode(this.userId, this.sketchId, this.nodeB, this.nodeA.id);
      }).then( result => {
        this.nodeB.id = result.nodeId;
        return sketchService.addTreeNode(this.userId, this.sketchId, this.nodeC, this.nodeB.id);
      }).then( result => {
        this.nodeC.id = result.nodeId;
        return sketchService.addTreeNode(this.userId, this.sketchId, this.nodeD, this.rootId);
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

  describe('remove node', function() {

    beforeEach(function(done){
      this.nodeA = createEmptyNode('a', '/a');
      this.nodeB = createEmptyNode('b', '/b');
      this.nodeC = createEmptyNode('c', '/c');
      this.nodeD = createEmptyNode('d', '/d');

      // Generate a tree
      sketchService.createRootNode(this.userId, this.sketchId, { name: '/'})
      .then( result => {
        this.rootId = result.tree.rootNode.id;
        return sketchService.addTreeNode(this.userId, this.sketchId, this.nodeA, this.rootId)
      }).then( result => {
        this.nodeA.id = result.nodeId;
        return sketchService.addTreeNode(this.userId, this.sketchId, this.nodeB, this.nodeA.id);
      }).then( result => {
        this.nodeB.id = result.nodeId;
        return sketchService.addTreeNode(this.userId, this.sketchId, this.nodeC, this.nodeB.id);
      }).then( result => {
        this.nodeC.id = result.nodeId;
        return sketchService.addTreeNode(this.userId, this.sketchId, this.nodeD, this.rootId);
      }).then( result => {
        this.nodeD.id = result.nodeId;
      }).finally(done);

    })

    it('should reject an atempt to remove a node when the node id is not defined', function(done) {
      sketchService.removeNode(this.userId, this.sketchId)
      .then( () => {
        fail('this call should have failed');
      }).catch( e => {
        expect(e).toBeDefined();
        expect(e.name).toBe('RapidoError');
        expect(e.message.startsWith('Cannot remove undefined node')).toBe(true);
      }).finally(done);
    })

    it('should reject an attempt to remove a non-existent node', function(done) {
      sketchService.removeNode(this.userId, this.sketchId, 'bad-id' )
      .then( () => {
        fail('this call should have failed');
      }).catch( e => {
        expect(e).toBeDefined();
        expect(e.message.startsWith('Unable to delete non-existent node with id:')).toBe(true);
      }).finally(done);
    })

    it('should apply a remove node event', function(done) {
      sketchService.removeNode(this.userId, this.sketchId, this.nodeB.id)
      .then(() => {
        return sketchService.getTree( this.sketchId )
      }).then( result => {
        expect(result.tree.hash[this.nodeB.id]).toBeUndefined();
      }).catch( e=> {fail(e)}).then(done)
    });
  })
});
