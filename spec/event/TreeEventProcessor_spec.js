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
