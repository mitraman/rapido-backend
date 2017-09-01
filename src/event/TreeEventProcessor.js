"use strict";

const winston = require('winston');
const Promise = require('bluebird');

let TreeEventProcessor = function () {
};

TreeEventProcessor.prototype.treenode_deleted = function(event, tree) {
  winston.log('debug', '[TreeEventProcessor.treenode_deleted] applying treenode_deleted event: ', event);
  if( !event.data ) {
    throw new Error('event is missing data property');
  }

  if( !event.data.nodeId ) {
    throw new Error('treenode_deleted event is missing a required property: data.nodeId');
  }

  // Make sure the the node exists in the tree
  let node = tree.hash[event.data.nodeId];
  if( !node ) {
    throw new Error('Unable to delete a non-existent node');
  }
  if( node.type === 'root' ) {
    throw new Error('treenode_deleted events cannot be applied to root nodes.');
  }

  winston.log('debug', '[TreeEventProcessor.treenode_deleted] deleting node ' + event.data.nodeId);

  // Remove the source node from its parent's child list
  let parentNode = tree.hash[node.parentId];
  let childList = null;
  childList = parentNode.children;

  for( let i = 0; i < childList.length; i++ ) {
    let child = childList[i];

    if( child.id === node.id ) {
      childList.splice(i, 1);
      break;
    }
  }

  // Remove the subtree from the in-memory hash
  let removeNodeFromHash = function(node) {
    node.children.forEach(child => {
      removeNodeFromHash(child);
    })
    delete tree.hash[node.id];
  }
  removeNodeFromHash(node);

  // Store the node in a deleted nodes property so it can be undone easily
  tree.deletedNodes[node.id] = node;



  return tree;

}

TreeEventProcessor.prototype.treenode_moved = function(event, tree) {
  winston.log('debug', '[TreeEventProcessor.treenode_moved] applying treenode_moved event: ', event);
  if( !event.data ) {
    throw new Error('event is missing data property');
  }
  if( !event.data.sourceId ) {
    throw new Error('treenode_moved event is missing a required property: data.sourceId');
  }
  if( !event.data.targetId ) {
    throw new Error('treenode_moved event is missing a required property: data.targetId');
  }

  // Make sure the the source node exists in the tree
  let sourceNode = tree.hash[event.data.sourceId];
  if( !sourceNode ) {
    throw new Error('Unable to move a non-existent node');
  }
  if( sourceNode.type === 'root') {
    throw new Error('treenode_moved event cannot be applied to a root node');
  }
  // Make sure that the target id exists in the tree
  if( event.data.targetId && !tree.hash[event.data.targetId] ) {
    throw new Error('Unable to move node to a non-existent target.');
  }

  winston.log('debug', '[TreeEventProcessor.treenode_moved] moving node ' + event.data.sourceId + ' to ' + event.data.targetId );

  // Remove the source node from its parent's child list
  let parentNode = tree.hash[sourceNode.parentId];
  let childList = null;
  childList = parentNode.children;

  for( let i = 0; i < childList.length; i++ ) {
    let child = childList[i];

    if( child.id === sourceNode.id ) {
      childList.splice(i, 1);
      break;
    }
  }

  tree.hash[event.data.targetId].children.push(sourceNode);

  // Update the parentId property of the node
  sourceNode.parentId = event.data.targetId;

  return tree;

}

// Defines the root node for this tree
// May be called at any time, but will replace the existing root with the
// new root and all of its children
TreeEventProcessor.prototype.treenode_defineroot = function(event, tree) {
  winston.log('debug', '[TreeEventProcessor.treenode_defineroot] applying treenode_defineroot event: ', event);
  if( !event.data ) {
    throw new Error('event is missing data property');
  }
  if( !event.data.rootNode ) {
    throw new Error('event is missing data.rootNode property');
  }

  let rootNode = event.data.rootNode;
  if(!rootNode.id) {
    throw new Error('root node is missing required property: id');
  }

  winston.log('debug', '[TreeEventProcessor.treenode_defineroot] Root node to be added is:', rootNode);

  rootNode.type = 'root';
  tree.rootNode = rootNode;
  tree.hash[rootNode.id] = rootNode;

  return tree;
}

// Adds a node as a child of an existing parent node
// event.data:
// {
//   parentId: ID of parent node
//   node: {
//     id: id of node to be added
//     _other attributes_
//   }
// }
TreeEventProcessor.prototype.treenode_added = function(event, tree) {
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

  if( !event.data.parentId ) {
    winston.log('warn', '[TreeEventProcessor.treenode_added] Unexpected parentId value of null');
    throw new Error('node is missing required property: parentId');
  }

  winston.log('debug', '[TreeEventProcessor.treenode_added] Node to be added is:', newNode);

  // Find the parent node for this node.
  let parentNode = tree.hash[event.data.parentId];
  if( !parentNode ) {
    throw new Error('the parent node with an ID ' + event.data.parentId + ' cannot be found in this tree');
  }
  // set the parentId to make moves and deletes easier
  newNode.parentId = event.data.parentId;
  newNode.type = 'node';
  winston.log('debug', '[TreeEventProcessor.treenode_added] Pushing node into children of parent node: ', parentNode);
  parentNode.children.push(newNode);


  tree.hash[newNode.id] = newNode;

  return tree;
}

TreeEventProcessor.prototype.treenode_updated_fields = function(event, tree) {
  let node = tree.hash[event.data.nodeId];
  if( !node ) {
    throw new Error('unable to locate node to be udated.');
  }

  // Iterate through the properties and update
  Object.keys(event.data.fields).forEach((fieldKey)=> {
    if(fieldKey === 'name') {
      if( node.type === 'root' ) {
        throw new Error('Updates to the name of a root node are not allowed.');
      }
      node.name = event.data.fields.name;

      //TODO: Resove the inconsistency of fullpath being set for addnodes
      // in the sketch service, while the updated path is set here.
      // Update the fullpath of this node
      let parentNode = tree.hash[node.parentId];
      if( parentNode.type === 'root') {
        node.fullpath = '/' + node.name;
      }else {
        node.fullpath = parentNode.fullpath + '/' + node.name;
      }


      // Update all of the descendant nodes with the new path
      let updateChildPaths = function(node) {
        node.children.forEach(child => {
          child.fullpath = node.fullpath + '/' + child.name;
          updateChildPaths(child);
        })
      }
      updateChildPaths(node);

    }else {
      winston.log('warn', 'unable to handle update of field property ' + fieldKey);
    }
  })
  return tree;
}

TreeEventProcessor.prototype.treenode_updated_data = function(event, tree ) {
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
      enabled: false,
      request: {
        contentType: '',
        queryParams: '',
        body: ''
      },
      response: {
        contentType: '',
        status: '200',
        body: ''
      }
    };
  }

  let dataObject = node.data[dataKey];

  // Update properties
  Object.keys(event.data.fields).forEach( (fieldKey) => {
    if( fieldKey === 'enabled' ) {
      dataObject.enabled = event.data.fields.enabled;
    }else if( fieldKey === 'request' ) {
      // Parse the request fields
      let request = event.data.fields.request;

      Object.keys(request).forEach( requestFieldKey => {
        if( requestFieldKey === 'contentType' ) {
          dataObject.request.contentType = request.contentType;
        }else if( requestFieldKey === 'queryParams' ) {
          dataObject.request.queryParams = request.queryParams;
        }else if( requestFieldKey === 'body' ) {
          dataObject.request.body = request.body;
        }else {
          winston.log('warn', '[TreeEventProcessor.treenode_updated_data] unable to handle update of node data rqeuest property ' + requestFieldKey);
        }
      })

    }else if( fieldKey === 'response' ) {
      // Parse response fields
      let response = event.data.fields.response;

      Object.keys(response).forEach( responseFieldKey => {
        if( responseFieldKey === 'contentType' ) {
          dataObject.response.contentType = response.contentType;
        }else if( responseFieldKey === 'status' ) {
          dataObject.response.status = response.status;
        }else if( responseFieldKey === 'body' ) {
          dataObject.response.body = response.body;
        }else {
          winston.log('warn', '[TreeEventProcessor.treenode_updated_data] unable to handle update of node data response property ' + responseFieldKey);
        }
      })
    }else {
      winston.log('warn', '[TreeEventProcessor.treenode_updated_data] unable to handle update of node data property ' + fieldKey);
    }
  });

  return tree;
}

// TreeEventProcessor.prototype.applyTreeEvent = function(event, tree) {
//   return new Promise( (resolve,reject) => {
//     winston.log('debug', '[TreeEventProcessor.applyTreeEvent]  handling event: ', event);
//     if( !TreeEventProcessor[event.type]) {
//       reject('unable to handle an unknown event type: ' + event.type);
//     } else {
//       // Apply the function
//       try {
//         winston.log('debug', '[TreeEventProcessor.applyTreeEvent] processing event.id:', event.id)
//         resolve(TreeEventProcessor[event.type](event, tree));
//       }catch(e) {
//         reject(e);
//       }
//     }
//   })
// }

module.exports = new TreeEventProcessor();
