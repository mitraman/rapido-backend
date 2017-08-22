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

  describe('treenode_deleted_processor', function() {

    let findNode = function(nodeList, nodeId) {
      for( var i = 0; i < nodeList.length; i++ ) {
        let node = nodeList[i];
        if( findNode(node.children, nodeId) ) {
          return true;
        }
        if( nodeId === node.id) {
          return true;
        }
      }
      return false;
    }

    beforeEach(function(done) {
      // Setup a tree for test operations:
      /*
                --> c
      a -> b ->
                --> d --> e
        -> f
      g
      */

      eventProcessor.applyEvent(treenodeAddedEvent(null, 'a', {}), emptyTree())
      .then( (result) => {
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
        return eventProcessor.applyEvent(treenodeAddedEvent(null, 'g', {}), result.tree);
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
        expect(updatedTree.rootNodes.length).toBe(2);
        expect(findNode(updatedTree.rootNodes, 'e')).toBe(false);
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
        expect(findNode(updatedTree.rootNodes, 'b')).toBe(false);
        expect(updatedTree.hash['b']).not.toBeDefined();
        expect(findNode(updatedTree.rootNodes, 'c')).toBe(false);
        expect(updatedTree.hash['c']).not.toBeDefined();
        expect(findNode(updatedTree.rootNodes, 'd')).toBe(false);
        expect(updatedTree.hash['d']).not.toBeDefined();
        expect(findNode(updatedTree.rootNodes, 'e')).toBe(false);
        expect(updatedTree.hash['e']).not.toBeDefined();
      }).catch( e => {
        fail(e);
      }).finally(done);
    });

    it('should remove a root node', function(done) {
      let event = {
        type: 'treenode_deleted',
        data: {
          nodeId: 'a'
        }
      }

      eventProcessor.applyEvent(event, this.treeForDeleteOperations)
      .then( (result) => {
        let updatedTree = result.tree;
        expect(updatedTree.rootNodes.length).toBe(1);
        expect(updatedTree.rootNodes[0].id).not.toBe('a');
        expect(findNode(updatedTree.rootNodes, 'b')).toBe(false);
        expect(updatedTree.hash['b']).not.toBeDefined();
        expect(findNode(updatedTree.rootNodes, 'c')).toBe(false);
        expect(updatedTree.hash['c']).not.toBeDefined();
        expect(findNode(updatedTree.rootNodes, 'd')).toBe(false);
        expect(updatedTree.hash['d']).not.toBeDefined();
        expect(findNode(updatedTree.rootNodes, 'e')).toBe(false);
        expect(updatedTree.hash['e']).not.toBeDefined();
        expect(findNode(updatedTree.rootNodes, 'f')).toBe(false);
        expect(updatedTree.hash['f']).not.toBeDefined();
      }).catch( e => {
        fail(e);
      }).finally(done);
    });

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

      eventProcessor.applyEvent(treenodeAddedEvent(null, 'a', {}), emptyTree())
      .then( (result) => {
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
        return eventProcessor.applyEvent(treenodeAddedEvent(null, 'g', {}), result.tree);
      }).then( result => {
        this.treeForMoveOperations = result.tree;
        done();
      })
    });

    it('should reject a treenode_moved event that is missing a sourceId property', function(done) {
      let event = {
        type: 'treenode_moved',
        data: {
          targetId: 'target'
        }
      }

      eventProcessor.applyEvent(event, emptyTree())
      .then( (result) => {
        fail('processor should have rejected this attempt')
      }).catch( e => {
        expect(e).toBeDefined();
        expect(e.message.indexOf('treenode_moved event is missing a required property: data.sourceId')).toBeGreaterThan(0);
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

      eventProcessor.applyEvent(event, emptyTree())
      .then( (updatedTree) => {
        fail('processor should have rejected this attempt')
      }).catch( e => {
        expect(e).toBeDefined();
        expect(e.message.indexOf('Unable to move a non-existent node')).toBeGreaterThan(0);
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

      eventProcessor.applyEvent(event, this.treeForMoveOperations)
      .then( (updatedTree) => {
        fail('processor should have rejected this attempt')
      }).catch( e => {
        expect(e).toBeDefined();
        expect(e.message.indexOf('Unable to move node to a non-existent target.')).toBeGreaterThan(0);
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
    //   eventProcessor.applyEvent(event, this.treeForMoveOperations)
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

      eventProcessor.applyEvent(event, this.treeForMoveOperations)
      .then( (result) => {
        let updatedTree = result.tree;
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

      eventProcessor.applyEvent(event, this.treeForMoveOperations)
      .then( (result) => {
        let updatedTree = result.tree;
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

      eventProcessor.applyEvent(event, this.treeForMoveOperations)
      .then( (result) => {
        let updatedTree = result.tree;
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

      eventProcessor.applyEvent(event, this.treeForMoveOperations)
      .then( (result) => {
        let updatedTree = result.tree;
        // make sure that the rootNode list has been updated
        expect(updatedTree.rootNodes.length).toBe(3);
        let f = updatedTree.rootNodes[2];
        expect(f.id).toBe('f');

        // assert that a only has one child left
        //console.log(updatedTree.hash['a']);
        expect(updatedTree.hash['a'].children.length).toBe(1);

        // f should have a parentId of null
        expect(f.parentId).toBeNull();
      }).catch( e => {
        fail(e);
      }).finally(done);

    })
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
      eventProcessor.applyEvent(event, emptyTree())
      .then( (result) => {
        let updatedTree = result.tree;
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

       eventProcessor.applyEvent(rootNodeOne, emptyTree())
       .then( result => {
         return eventProcessor.applyEvent(rootNodeTwo, result.tree)
       }).then( result => {
         expect(result.tree.hash[nodeOneId]).toBeDefined();
         expect(result.tree.hash[nodeTwoId]).toBeDefined();
         done();
       })

    })

    it('should apply a treenode_added event for a child', function(done) {
      let parentEvent = treenodeAddedEvent(null, 'parent-node', {});
      let childEvent = treenodeAddedEvent('parent-node', 'child-node', {});

      eventProcessor.applyEvent(parentEvent, emptyTree())
      .then( (result) => {
        return eventProcessor.applyEvent(childEvent, result.tree);
      }).then( result => {
        expect(result.tree).toBeDefined();
        expect(result.tree.rootNodes.length).toBe(1);
        expect(result.tree.rootNodes[0].children.length).toBe(1);
        expect(result.tree.rootNodes[0].id).toBe('parent-node');
        expect(result.tree.rootNodes[0].children[0].id).toBe('child-node');
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

      eventProcessor.applyEvent(updateNodeEvent, emptyTree())
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

      eventProcessor.applyEvent(parentEvent, emptyTree())
      .then( (result) => {
        return eventProcessor.applyEvent(childEvent, result.tree);
      }).then( (result) => {
        return eventProcessor.applyEvent(secondChildEvent, result.tree);
      }).then( (result) => {
        return eventProcessor.applyEvent(updateSecondChildEvent, result.tree);
      }).then( (result) => {
        let secondChildNode = result.tree.rootNodes[0].children[0].children[0];
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

      eventProcessor.applyEvent(addEvent, emptyTree())
      .then( (result) => {
        return eventProcessor.applyEvent(updateEvent, result.tree);
      }).then( (result) => {
        expect(result.tree.rootNodes[0].fullpath).toBe('newPath');
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
            enabled: false,
            request: {
              contentType: 'application/json',
              queryParams:'?name=value&name=value',
              body: ''
            },
            response: {
              contentType: 'application/json',
              status: '200',
              body: '{[{name: \"sample value\"}]'
            }
          }
        }
      }

      eventProcessor.applyEvent(addEvent, emptyTree())
      .then( (result) => {
        return eventProcessor.applyEvent(updateDataEvent, result.tree);
      }).then( (result) => {
        let getData = result.tree.rootNodes[0].data.get;
        expect(getData).toBeDefined();
        expect(getData.enabled).toBe(updateDataEvent.data.fields.enabled);

        expect(getData.request.contentType).toBe(updateDataEvent.data.fields.request.contentType);
        expect(getData.request.queryParams).toEqual(updateDataEvent.data.fields.request.queryParams);
        expect(getData.request.body).toEqual(updateDataEvent.data.fields.request.body);

        expect(getData.response.contentType).toBe(updateDataEvent.data.fields.response.contentType);
        expect(getData.response.body).toEqual(updateDataEvent.data.fields.response.body);
        expect(getData.response.status).toEqual(updateDataEvent.data.fields.response.status);


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
            enabled: true,
            response: {
              status: '200',
              contentType: 'application/json',
              body: '{[{name: \"sample value\"}]'
            }
          }
        }
      };


      const secondUpdateDataEvent = {
        type: 'treenode_updated_data',
        data: {
          nodeId: 'node1',
          key: 'put',
          fields: {
            response: {
              body: 'new'
            }
          }
        }
      };


      eventProcessor.applyEvent(addEvent, emptyTree())
      .then( (result) => {
        return eventProcessor.applyEvent(firstUpdateDataEvent, result.tree);
      }).then( (result) => {
        return eventProcessor.applyEvent(secondUpdateDataEvent, result.tree);
      }).then( (result) => {
        let putData = result.tree.rootNodes[0].data.put;
        expect(putData).toBeDefined();
        expect(putData.response.contentType).toBe(firstUpdateDataEvent.data.fields.response.contentType);
        expect(putData.enabled).toBe(firstUpdateDataEvent.data.fields.enabled);
        expect(putData.response.body).toEqual(secondUpdateDataEvent.data.fields.response.body);
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

      eventProcessor.applyEvent(badUpdateDataEvent, emptyTree())
      .then( ()=> {
        fail('this call should have been rejected.')
      }).catch( e => {
        expect(e).toBeDefined();
        expect(e.message).toBeDefined();
        expect(e.message.indexOf('Unable to update data for non-existent node')).toBeGreaterThan(0);
      }).finally(done);

    })

  });
});
