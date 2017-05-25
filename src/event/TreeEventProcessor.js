"use strict";

const winston = require('winston');
const Promise = require('bluebird');

let TreeEventProcessor = function () {
};

TreeEventProcessor.treenode_added = function(event, tree) {
  winston.log('debug', '[TreeEventProcessor.treenode_added] applying treenode_added event: ', event);
  if( !event.data ) {
    throw new Error('event is missing data property');
  }
  if( !event.data.node ) {
    throw new Error('event is missing data.node property');
  }

  // attach a node to the tree root by default
  let newNode = event.data.node;
  if( !newNode.id ) {
    throw new Error('node is missing required property: id');
  }
  winston.log('debug', '[TreeEventProcessor.treenode_added] Node to be added is:', newNode);


  // Find the parent node for this node.
  if( !event.data.parentId ) {
    winston.log('debug', '[TreeEventProcessor.treenode_added] Adding node to root of tree');
    tree.rootNodes.push(newNode);
  }else {
    let parentNode = tree.hash[event.data.parentId];
    winston.log('debug', '[TreeEventProcessor.treenode_added] Pushing node into children of parent node: ', parentNode);
    parentNode.children.push(newNode);
  }

  tree.hash[newNode.id] = newNode;

  return tree;
}

TreeEventProcessor.treenode_updated_fields = function(event, tree) {
  let node = tree.hash[event.data.nodeId];
  if( !node ) {
    throw new Error('unable to locate node to be udated.');
  }

  //TODO: remove fullpath as a property.  fullpath should be constructed
  // based on the tree data, not persisted

  // Iterate through the properties and update
  Object.keys(event.data.fields).forEach((fieldKey)=> {
    if(fieldKey === 'name') {
      node.name = event.data.fields.name;
    }else if( fieldKey === 'fullpath') {
      node.fullpath = event.data.fields.fullpath;
    }else {
      winston.log('warn', 'unable to handle update of field property ' + fieldKey);
    }
  })
  return tree;
}

TreeEventProcessor.treenode_updated_data = function(event, tree ) {
  winston.log('debug', '[TreeEventProcessor.treenode_updated_data] applying treenode_updated_data event: ', event);
  let node = tree.hash[event.data.nodeId];

  if( !node ) {
    throw Error('Unable to update data for non-existent node id:', event.data.nodeId);
  }
  let dataKey = event.data.key;
    winston.log('debug', '[TreeEventProcessor.treenode_updated_data] node:', node);
  if( !node.data ) {
    node.data = {};
  }
  winston.log('debug', '[TreeEventProcessor.treenode_updated_data] node.data:', node.data);

  if( !node.data[dataKey] ) {
    winston.log('debug', '[TreeEventProcessor.treenode_updated_data] creating empty data object');

    // Create the data object if it doesn't already exist
    node.data[dataKey] = {
      contentType: '',
      enabled: false,
      queryParams: '',
      requestBody: '',
      responseBody: ''
    };
  }

  let dataObject = node.data[dataKey];

  // Update properties
  Object.keys(event.data.fields).forEach( (fieldKey) => {
    if( fieldKey === 'contentType' ) {
      dataObject.contentType = event.data.fields.contentType;
    }else if( fieldKey === 'enabled' ) {
      dataObject.enabled = event.data.fields.enabled;
    }else if( fieldKey === 'queryParams' ) {
      dataObject.queryParams = event.data.fields.queryParams;
    }else if( fieldKey === 'requestBody' ) {
      dataObject.requestBody = event.data.fields.requestBody;
    }else if( fieldKey === 'responseBody' ) {
      dataObject.responseBody = event.data.fields.responseBody;
    }else {
      winston.log('warn', '[TreeEventProcessor.treenode_updated_data] unable to handle update of node data property ' + fieldKey);
    }
  });

  return tree;
}

TreeEventProcessor.prototype.applyTreeEvent = function(event, tree) {
  return new Promise( (resolve,reject) => {
    winston.log('debug', '[TreeEventProcessor.applyTreeEvent]  handling event: ', event);
    if( !TreeEventProcessor[event.type]) {
      reject('unable to handle an unknown event type: ' + event.type);
    } else {
      // Apply the function
      try {
        winston.log('debug', '[TreeEventProcessor.applyTreeEvent] processing event.id:', event.id)
        resolve(TreeEventProcessor[event.type](event, tree));
      }catch(e) {
        reject(e);
      }
    }
  })
}

module.exports = new TreeEventProcessor();
