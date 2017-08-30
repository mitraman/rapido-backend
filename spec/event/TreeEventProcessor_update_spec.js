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

describe('TreeEventProcessor:UpdateNode', function() {
  beforeEach(function(done) {
    // Setup a tree with a root node
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
      this.tree = result.tree;
    }).catch(e => {
      console.log('error: ', e);
      fail(e);
    }).finally(done);
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

  it('should reject an attempt to update the name of a root node', function(done) {
    const updateNodeEvent = {
        type: 'treenode_updated_fields',
        data: {
          nodeId: 'root',
          fields: {
            name: 'invalid-change'
          }
        }
    }

    eventProcessor.applyEvent(updateNodeEvent, this.tree)
    .then( () => {
      fail('expected applyTreeEvent to throw an error')
    }).catch( (e) => {
      expect(e).toBeDefined();
      expect(e.message.indexOf('Updates to the name of a root node are not allowed.')).toBeGreaterThan(0);
    }).finally(done);
  })

  it('should update the name of an existing node', function(done) {
    // Setup a tree to be updated
    let parentEvent = treenodeAddedEvent('root', 'parent-node', {});
    let childEvent = treenodeAddedEvent('parent-node', 'child-node', {});
    let gc1Event = treenodeAddedEvent('child-node', 'grandchild1', {});
    let gc2Event = treenodeAddedEvent('child-node', 'grandchild2', {});
    let ggcEvent = treenodeAddedEvent('grandchild2', 'great-grandchild', {});

    const updateChildEvent = {
        type: 'treenode_updated_fields',
        data: {
          nodeId: 'child-node',
          fields: {
            name: 'new name'
          }
        }
    }

    eventProcessor.applyEvent(parentEvent, this.tree)
    .then( (result) => {
      return eventProcessor.applyEvent(childEvent, result.tree);
    }).then( (result) => {
      return eventProcessor.applyEvent(gc1Event, result.tree);
    }).then( (result) => {
      return eventProcessor.applyEvent(gc2Event, result.tree);
    }).then( (result) => {
      return eventProcessor.applyEvent(ggcEvent, result.tree);
    }).then( result => {
      return eventProcessor.applyEvent(updateChildEvent, result.tree);
    }).then( (result) => {
      let childNode = result.tree.rootNode.children[0].children[0];
      let gc1Node = result.tree.rootNode.children[0].children[0].children[0];
      let gc2Node = result.tree.rootNode.children[0].children[0].children[1];
      let ggcNode = result.tree.rootNode.children[0].children[0].children[1].children[0];
      expect(childNode.name).toBe('new name');
      expect(childNode.fullpath).toBe('/parent-node/new name');
      expect(gc1Node.fullpath).toBe('/parent-node/new name/grandchild1');
      expect(gc2Node.fullpath).toBe('/parent-node/new name/grandchild2');
      expect(ggcNode.fullpath).toBe('/parent-node/new name/grandchild2/great-grandchild');
    }).catch( e=> {
      fail(e);
    }).finally( ()=> {
      done();
    })
  });

  it('should add a get data object of an existing node', function(done) {
    let addEvent = treenodeAddedEvent('root', 'node1', {});
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

    eventProcessor.applyEvent(addEvent, this.tree)
    .then( (result) => {
      return eventProcessor.applyEvent(updateDataEvent, result.tree);
    }).then( (result) => {
      let getData = result.tree.rootNode.children[0].data.get;
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
    let addEvent = treenodeAddedEvent('root', 'node1', {});
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


    eventProcessor.applyEvent(addEvent, this.tree)
    .then( (result) => {
      return eventProcessor.applyEvent(firstUpdateDataEvent, result.tree);
    }).then( (result) => {
      return eventProcessor.applyEvent(secondUpdateDataEvent, result.tree);
    }).then( (result) => {
      let putData = result.tree.rootNode.children[0].data.put;
      expect(putData).toBeDefined();
      expect(putData.response.contentType).toBe(firstUpdateDataEvent.data.fields.response.contentType);
      expect(putData.enabled).toBe(firstUpdateDataEvent.data.fields.enabled);
      expect(putData.response.body).toEqual(secondUpdateDataEvent.data.fields.response.body);
    }).catch( e => { fail(e); }).finally(done);
  })

  it('should replace a put data object of an existing node', function(done) {
    let addEvent = treenodeAddedEvent('root', 'node1', {});
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


    eventProcessor.applyEvent(addEvent, this.tree)
    .then( (result) => {
      return eventProcessor.applyEvent(firstUpdateDataEvent, result.tree);
    }).then( (result) => {
      return eventProcessor.applyEvent(secondUpdateDataEvent, result.tree);
    }).then( (result) => {
      let putData = result.tree.rootNode.children[0].data.put;
      expect(putData).toBeDefined();
      expect(putData.response.contentType).toBe(firstUpdateDataEvent.data.fields.response.contentType);
      expect(putData.enabled).toBe(firstUpdateDataEvent.data.fields.enabled);
      expect(putData.response.body).toEqual(secondUpdateDataEvent.data.fields.response.body);
    }).catch( e => { fail(e); }).finally(done);
  })

})
