"use strict";

const winston = require('winston');
const Promise = require('bluebird');
const treeEventProcessor = require('../../src/event/TreeEventProcessor.js');

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
    rootNodes: []
  };
};

describe('TreeEventProcessor', function() {

  this.sketchId = 10;

  describe('processor', function() {

    it('should reject an attempt to apply an unknown event', function(done) {
      let sketchId = 4;
      let event = {
        type: 'unknown_type'
      }
      treeEventProcessor.applyTreeEvent(event)
      .then( () => {
        fail('the cache should have rejected this attempt')
      }).catch( e => {
        expect(e).toBeDefined();
        expect(e.startsWith('unable to handle an unknown event type')).toBe(true);
        done();
      })
    })

  })

  describe('treenode_moved processor', function() {

    beforeEach(function(done) {
      // Setup a tree for test operations:
      /*
                --> c
      a -> b ->
                --> d --> e
        -> f
      g
      */

      treeEventProcessor.applyTreeEvent(treenodeAddedEvent(null, 'a', {}), emptyTree())
      .then( (tree) => {
        return treeEventProcessor.applyTreeEvent(treenodeAddedEvent('a', 'b', {}), tree);
      }).then( tree => {
        return treeEventProcessor.applyTreeEvent(treenodeAddedEvent('a', 'f', {}), tree);
      }).then( tree => {
        return treeEventProcessor.applyTreeEvent(treenodeAddedEvent('b', 'c', {}), tree);
      }).then( tree => {
        return treeEventProcessor.applyTreeEvent(treenodeAddedEvent('b', 'd', {}), tree);
      }).then( tree => {
        return treeEventProcessor.applyTreeEvent(treenodeAddedEvent('d', 'e', {}), tree);
      }).then( tree => {
        return treeEventProcessor.applyTreeEvent(treenodeAddedEvent(null, 'g', {}), tree);
      }).then( tree => {
        this.treeForMoveOperations = tree;
        done();
      })

    })

    it('should reject a treenode_moved event that is missing a sourceId property', function(done) {
      let event = {
        type: 'treenode_moved',
        data: {
          targetId: 'target'
        }
      }

      treeEventProcessor.applyTreeEvent(event, emptyTree())
      .then( (updatedTree) => {
        fail('processor should have rejected this attempt')
      }).catch( e => {
        expect(e).toBeDefined();
        expect(e.message).toBe('treenode_moved event is missing a required property: data.sourceId');
      }).finally(done);
    })

    it('should reject a treenode_moved event that moves a node that does not exist', function(done) {
      const sourceId = 10;
      const targetId = 'a';
      let event = {
        type: 'treenode_moved',
        data: {
          sourceId: sourceId,
          targetId: targetId
        }
      }

      treeEventProcessor.applyTreeEvent(event, emptyTree())
      .then( (updatedTree) => {
        fail('processor should have rejected this attempt')
      }).catch( e => {
        expect(e).toBeDefined();
        expect(e.message).toBe('Unable to move a non-existent node');
      }).finally(done);
    })

    it('should reject a treenode_moved event that moves a node to a target that does not exist', function(done) {
      const sourceId = 'a';
      const targetId = 14;
      let event = {
        type: 'treenode_moved',
        data: {
          sourceId: sourceId,
          targetId: targetId
        }
      }

      treeEventProcessor.applyTreeEvent(event, this.treeForMoveOperations)
      .then( (updatedTree) => {
        fail('processor should have rejected this attempt')
      }).catch( e => {
        expect(e).toBeDefined();
        expect(e.message).toBe('Unable to move node to a non-existent target.');
      }).finally(done);
    })


    // The event processor shouldn't reject the circular case.  Instead, we will just apply what has been recorded.
    // This kind of error checking should happen _before_ the event is recorded.
    // fit('should reject an attempt to create a circular tree?', function(done) {
    //   const sourceId = 'a';
    //   const targetId = 'e';
    //   let event = {
    //     type: 'treenode_moved',
    //     data: {
    //       sourceId: sourceId,
    //       targetId: targetId
    //     }
    //   }
    //
    //   treeEventProcessor.applyTreeEvent(event, this.treeForMoveOperations)
    //   .then( (updatedTree) => {
    //     fail('this move should not have succeeded')
    //   }).catch( e => {
    //     expect(e).toBeDefined;
    //     expect(e.message).toBe('Unable to apply treenode_moved event because it would result in a circular tree');
    //   }).finally(done);
    //
    // })

    it('should move the rootnode of a tree', function(done) {
      const sourceId = 'g';
      const targetId = 'f';
      let event = {
        type: 'treenode_moved',
        data: {
          sourceId: sourceId,
          targetId: targetId
        }
      }

      treeEventProcessor.applyTreeEvent(event, this.treeForMoveOperations)
      .then( (updatedTree) => {
        expect(updatedTree.rootNodes.length).toBe(1);
        expect(updatedTree.hash['f'].children.length).toBe(1);
        let g = updatedTree.hash['f'].children[0];
        expect(g.id).toBe('g');
        expect(g.parentId).toBe('f');
      }).catch( e => {
        fail(e);
      }).finally(done);

    })

    it('should apply a treenode_moved event for a child node', function(done) {
      const sourceId = 'e';
      const targetId = 'f';
      let event = {
        type: 'treenode_moved',
        data: {
          sourceId: sourceId,
          targetId: targetId
        }
      }

      treeEventProcessor.applyTreeEvent(event, this.treeForMoveOperations)
      .then( (updatedTree) => {
        // make sure that node e is now a child of f
        expect(updatedTree.hash['f'].children.length).toBe(1);
        expect(updatedTree.hash['f'].children[0].id).toBe('e');

        // make sure that the parentId property of the node is update
        expect(updatedTree.hash['e'].parentId).toBe('f');

        // assert that e is no longer a child of d
        expect(updatedTree.hash['d'].children.length).toBe(0);
      }).catch( e => {
        fail(e);
      }).finally(done);
    })

    it('should move a subtree if the root node is moved', function(done) {
      const sourceId = 'b';
      const targetId = 'f';
      let event = {
        type: 'treenode_moved',
        data: {
          sourceId: sourceId,
          targetId: targetId
        }
      }

      treeEventProcessor.applyTreeEvent(event, this.treeForMoveOperations)
      .then( (updatedTree) => {
        // make sure that the tree with root node b is now a child of f
        expect(updatedTree.hash['f'].children.length).toBe(1);
        expect(updatedTree.hash['f'].children[0].id).toBe('b');

        // assert that b still has its children and grandchildren
        let b = updatedTree.hash['f'].children[0];
        expect(b.children.length).toBe(2);
        let c = b.children[0];
        let d = b.children[1];
        expect(c.id).toBe('c');
        expect(d.id).toBe('d');
        expect(d.children.length).toBe(1);
        expect(d.children[0].id).toBe('e');

        // assert that a not longer has children
        expect(updatedTree.hash['a'].children.length).toBe(1);
      }).catch( e => {
        fail(e);
      }).finally(done);

    })

    it('should move a node to the root', function(done) {
      const sourceId = 'f';
      const targetId = null;
      let event = {
        type: 'treenode_moved',
        data: {
          sourceId: sourceId,
          targetId: targetId
        }
      }

      treeEventProcessor.applyTreeEvent(event, this.treeForMoveOperations)
      .then( (updatedTree) => {
        // make sure that the rootNode list has been updated
        expect(updatedTree.rootNodes.length).toBe(3);
        let f = updatedTree.rootNodes[2];
        expect(f.id).toBe('f');

        // assert that a only has one child left
        console.log(updatedTree.hash['a']);
        expect(updatedTree.hash['a'].children.length).toBe(1);

        // f should have a parentId of null
        expect(f.parentId).toBeNull();
      }).catch( e => {
        fail(e);
      }).finally(done);

    })
  })

  describe('treenode_deleted processor', function() {

  })

  describe('treenode_added processor', function() {

    it('should apply a treenode_added event for the root ', function(done) {
      let sketchId = 5;
      let event = {
        type: 'treenode_added',
        data: {
          parentId: null,
          node: {
            id: 'test-node',
            name: 'node',
            fullpath: '/node',
            responseData : {},
            children: []
          }
        }
      }
      treeEventProcessor.applyTreeEvent(event, emptyTree())
      .then( (updatedTree) => {
        expect(updatedTree.rootNodes.length).toBe(1);
        expect(updatedTree.rootNodes[0].id).toBe('test-node');
        done();
      }).catch( e => {
        fail(e);
      })
    })

    it('should apply two treenode_added events to the root ', function(done) {
      const nodeOneId = 'node-1';
      const nodeTwoId = 'node-2';
      let rootNodeOne = treenodeAddedEvent(null, nodeOneId, {});
      let rootNodeTwo = treenodeAddedEvent(null, nodeTwoId, {});

       treeEventProcessor.applyTreeEvent(rootNodeOne, emptyTree())
       .then( updatedTree => {
         return treeEventProcessor.applyTreeEvent(rootNodeTwo, updatedTree)
       }).then( tree => {
         expect(tree.hash[nodeOneId]).toBeDefined();
         expect(tree.hash[nodeTwoId]).toBeDefined();
         done();
       })

    })

    it('should apply a treenode_added event for a child', function(done) {
      let parentEvent = treenodeAddedEvent(null, 'parent-node', {});
      let childEvent = treenodeAddedEvent('parent-node', 'child-node', {});

      treeEventProcessor.applyTreeEvent(parentEvent, emptyTree())
      .then( (updatedTree) => {
        return treeEventProcessor.applyTreeEvent(childEvent, updatedTree);
      }).then( tree => {
        expect(tree).toBeDefined();
        expect(tree.rootNodes.length).toBe(1);
        expect(tree.rootNodes[0].children.length).toBe(1);
        expect(tree.rootNodes[0].id).toBe('parent-node');
        expect(tree.rootNodes[0].children[0].id).toBe('child-node');
        done();
      }).catch( e => {
        fail(e);
      })
    })

    it('should reject an attempt to update a node that does not exist', function(done) {
      const updateNodeEvent = {
          type: 'treenode_updated_fields',
          data: {
            nodeId: 'bad-node',
            fields: {
            }
          }
      }

      treeEventProcessor.applyTreeEvent(updateNodeEvent, emptyTree())
      .then( () => {
        fail('expected applyTreeEvent to throw an error')
      }).catch( (e) => {
        expect(e).toBeDefined();
      }).finally(done);
    })

    it('should update the name of an existing node', function(done) {
      let parentEvent = treenodeAddedEvent(null, 'parent-node', {});
      let childEvent = treenodeAddedEvent('parent-node', 'child-node', {});
      let secondChildEvent = treenodeAddedEvent('child-node', 'second-child', {});
      const updateSecondChildEvent = {
          type: 'treenode_updated_fields',
          data: {
            nodeId: 'second-child',
            fields: {
              name: 'new name'
            }
          }
      }

      treeEventProcessor.applyTreeEvent(parentEvent, emptyTree())
      .then( (updatedTree) => {
        return treeEventProcessor.applyTreeEvent(childEvent, updatedTree);
      }).then( (updatedTree) => {
        return treeEventProcessor.applyTreeEvent(secondChildEvent, updatedTree);
      }).then( (updatedTree) => {
        return treeEventProcessor.applyTreeEvent(updateSecondChildEvent, updatedTree);
      }).then( (tree) => {
        let secondChildNode = tree.rootNodes[0].children[0].children[0];
        expect(secondChildNode).toBeDefined();
        expect(secondChildNode.name).toBe('new name');
        expect(secondChildNode.fullpath).toBe(secondChildEvent.data.node.fullpath);
      }).catch( e=> {
        fail(e);
      }).finally( ()=> {
        done();
      })
    });

    it('should update the fullpath of an existing node', function(done) {
      let addEvent = treenodeAddedEvent(null, 'node1', {});
      const updateEvent = {
          type: 'treenode_updated_fields',
          data: {
            nodeId: 'node1',
            fields: {
              fullpath: 'newPath'
            }
          }
      }

      treeEventProcessor.applyTreeEvent(addEvent, emptyTree())
      .then( (updatedTree) => {
        return treeEventProcessor.applyTreeEvent(updateEvent, updatedTree);
      }).then( (tree) => {
        expect(tree.rootNodes[0].fullpath).toBe('newPath');
      }).catch( e => { fail(e); }).finally(done);
    })

    it('should add a get data object of an existing node', function(done) {
      let addEvent = treenodeAddedEvent(null, 'node1', {});
      const updateDataEvent = {
        type: 'treenode_updated_data',
        data: {
          nodeId: 'node1',
          key: 'get',
          fields: {
            contentType: 'application/json',
            enabled: false,
            queryParams:'?name=value&name=value',
            requestBody: '',
            responseBody: '{[{name: \"sample value\"}]'
          }
        }
      }

      treeEventProcessor.applyTreeEvent(addEvent, emptyTree())
      .then( (updatedTree) => {
        return treeEventProcessor.applyTreeEvent(updateDataEvent, updatedTree);
      }).then( (tree) => {
        let getData = tree.rootNodes[0].data.get;
        expect(getData).toBeDefined();
        expect(getData.contentType).toBe(updateDataEvent.data.fields.contentType);
        expect(getData.enabled).toBe(updateDataEvent.data.fields.enabled);
        expect(getData.responseBody).toEqual(updateDataEvent.data.fields.responseBody);
        expect(getData.requestBody).toEqual(updateDataEvent.data.fields.requestBody);
        expect(getData.queryParams).toEqual(updateDataEvent.data.fields.queryParams);
      }).catch( e => { fail(e); }).finally(done);

    });

    it('should replace a put data object of an existing node', function(done) {
      let addEvent = treenodeAddedEvent(null, 'node1', {});
      const firstUpdateDataEvent = {
        type: 'treenode_updated_data',
        data: {
          nodeId: 'node1',
          key: 'put',
          fields: {
            contentType: 'application/json',
            enabled: false,
            responseBody: '{[{name: \"sample value\"}]'
          }
        }
      };


      const secondUpdateDataEvent = {
        type: 'treenode_updated_data',
        data: {
          nodeId: 'node1',
          key: 'put',
          fields: {
            responseBody: 'new'
          }
        }
      };


      treeEventProcessor.applyTreeEvent(addEvent, emptyTree())
      .then( (updatedTree) => {
        return treeEventProcessor.applyTreeEvent(firstUpdateDataEvent, updatedTree);
      }).then( (updatedTree) => {
        return treeEventProcessor.applyTreeEvent(secondUpdateDataEvent, updatedTree);
      }).then( (tree) => {
        let putData = tree.rootNodes[0].data.put;
        expect(putData).toBeDefined();
        expect(putData.contentType).toBe(firstUpdateDataEvent.data.fields.contentType);
        expect(putData.enabled).toBe(firstUpdateDataEvent.data.fields.enabled);
        expect(putData.responseBody).toEqual(secondUpdateDataEvent.data.fields.responseBody);
      }).catch( e => { fail(e); }).finally(done);
    })

    it('should reject an attempt to update the data of a non-existent node', function(done) {
      const badUpdateDataEvent = {
        type: 'treenode_updated_data',
        data: {
          nodeId: 'node1',
          key: 'put',
          fields: {
            responseBody: 'new'
          }
        }
      };

      treeEventProcessor.applyTreeEvent(badUpdateDataEvent, emptyTree())
      .then( ()=> {
        fail('this call should have been rejected.')
      }).catch( e => {
        expect(e).toBeDefined();
        expect(e.message).toBeDefined();
        expect(e.message.startsWith('Unable to update data for non-existent node')).toBe(true);
      }).finally(done);

    })

  });
});
