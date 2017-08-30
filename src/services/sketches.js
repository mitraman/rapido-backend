"use strict";

const EventStore = require('../event/EventStore.js');
const winston = require('winston');
const uuidV4 = require('uuid/v4');
const Cache = require('./Cache.js');
const EventSubscription = require('../event/EventSubscription.js')
const eventProcessor = require('../../src/event/EventProcessor.js');
const Promise = require('bluebird');
const RapidoError = require('../errors/rapido-error.js');
const RapidoErrorCodes = require('../errors/codes.js');


let Sketches = function () {
  winston.log('debug', 'in Sketches constructor');
  Sketches.cache = new Cache();
  Sketches.es = new EventStore();
  Sketches.eventSubscriptions = {};
};

//TODO: Setup interval timer to unsubscribe and remove a subscription
Sketches.getSubscription = function(sketchId, label) {
  return new Promise( (resolve, reject) => {
    // Retrieve a subscriber object (the tree cache is available from the subscriber)
    winston.log('debug', '[Sketches.getSubscription] sketchId is: ', sketchId);
    Sketches.cache.get(sketchId)
    .then( subscriber => {
      // if we don't already have a subscriber, create and store one
      if( !subscriber) {
        winston.log('debug', '[Sketches.getSubscription] No subscriber found in cache, creating a new subscription');

        // Create a new subscriber object
        subscriber = new EventSubscription(sketchId, eventProcessor, label);
        Sketches.es.subscribe(sketchId, subscriber.onEvent, 0);
        winston.log('debug', '[Sketches.getSubscription] storing subscription: ', subscriber);
        // Store the subscription in cache
        Sketches.cache.set(sketchId, subscriber);
        resolve(subscriber);
      }else {
        winston.log('debug', '[Sketches.getSubscription] An existing subscriber was retrieved form cache: ', subscriber);
        winston.log('debug', '[Sketches.getSubscription] lastEventIDProcessed:', subscriber.getLastEventID());
        resolve(subscriber);
      }

    })
  });
}

Sketches.prototype.getTree = function(sketchId, label) {
  winston.log('debug','[Sketches.getTree] invoked');
  // Get the most recent version of the tree by checking for the last event
  // recorded for this sketch.
  return new Promise( (resolve, reject) => {
    let subscriber;
    Sketches.getSubscription(sketchId, label)
    .then( result => {
      winston.log('debug', '[Sketches.getTree] cached tree:', result.tree);
      this.subscriber = result;
      return Sketches.es.getLastEventID(sketchId);
    }).then( lastEventID => {
      winston.log('debug', '[Sketches.getTree] lastEventID for this sketch:', lastEventID);
      if( lastEventID ) {
        if( this.subscriber.lastEventIDProcessed >= lastEventID ) {
          winston.log('debug', '[Sketches.getTree] subscriber is up to date')
          resolve({tree:this.subscriber.tree})
        }else {
          winston.log('debug', '[Sketches.getTree] waiting for historical events to be applied.');
          // Setup an event handler to listen for processed events
          let processedHandler = function(event) {
            // If we catch the event we are pushing, resolve the promise
            winston.log('debug', '[Sketches.getTree] processed event caught:', event);
            if( event.id >= lastEventID) {
              this.subscriber.stream().removeListener('event_processed', processedHandler);
              resolve({
                tree: this.subscriber.tree
              });
            }
          }.bind(this);
          this.subscriber.stream().on('event_processed', processedHandler);
        }
      }else {
        winston.log('debug', '[Sketches.getTree] no historical events exist for this sketch.');
        resolve({tree:this.subscriber.tree});
      }
    });
  })
}

Sketches.prototype.createRootNode = function(userId, sketchId, rootNode) {
  return new Promise( (resolve,reject) => {
    // Generate a unique ID for the new node
    const nodeId = uuidV4();

    // Generate a temporary token to identify the event that we are pushing
    const token = uuidV4();

    // Retrieve a subscriber object (the tree cache is available from the subscriber)
    Sketches.getSubscription(sketchId)
    .then( subscriber =>  {
      winston.log('debug', '[Sketches.setRootNode] subscriber:', subscriber);

      // Set the fullpath to wahtever the name of the rootnode is
      let fullPath = rootNode.name;

      // Setup an event handler to listen for processed events
      let processedHandler = function(event) {
        // If we catch the event we are pushing, resolve the promise
        winston.log('[Sketches.setRootNode] processed event caught:', event);
        if( event.token === token) {
          //now that we know the event has been processed, stop listening
          subscriber.stream().removeListener('event_processed', processedHandler);
          resolve({
            nodeId: nodeId,
            tree: subscriber.tree
          });
        }
      }
      subscriber.stream().on('event_processed', processedHandler);

      winston.log('debug', '[Sketches.setRootNode] recording tree node addition event');
      // Record the tree node addition event
      return Sketches.es.push(userId, sketchId,
        'treenode_defineroot',
        {
          rootNode: {
            id: nodeId,
            name: rootNode.name,
            data : rootNode.data,
            fullpath: fullPath,
            children: []
          }
        }, token);
    }).catch( e => {
      reject(e);
    })
  })
}

Sketches.prototype.addTreeNode = function(userId, sketchId, treeNode, parentId, label) {
  return new Promise( (resolve, reject) => {
    // Generate a unique ID for the new node
    const nodeId = uuidV4();

    // Generate a temporary token to identify the event that we are pushing
    const token = uuidV4();

    // Retrieve a subscriber object (the tree cache is available from the subscriber)
    Sketches.getSubscription(sketchId, label)
    .then( subscriber =>  {
      winston.log('debug', '[Sketches.addTreeNode] subscriber:', subscriber);

      // Default value for fullPath
      let fullPath = '/' + treeNode.name;

      // Validate the request
      if(!parentId) {
        winston.log('warning', '[Sketches.addTreeNode] missing required parameter parentId on call to add node');
        reject(new RapidoError(RapidoErrorCodes.fieldValidationError, 'Unable to add node', 500));
        return;
      }

      console.log(subscriber.tree);

      let parentNode = subscriber.tree.hash[parentId];
      if(!parentNode) {
        let errorMessage = 'Cannot add node to non-existent parent node with ID:' + parentId;
        reject(new RapidoError(RapidoErrorCodes.fieldValidationError, errorMessage, 400,
          [{ field: "nodeId", type: "invalid", description: errorMessage}]));
        //reject('Cannot add node to non-existent parent node with ID:' + parentId);
        return;
      }else {
        console.log('*****')
        console.log('setting fullpath for ', treeNode.name);
        console.log('parentNode is ', parentNode);
        if( parentNode.type === 'root') {
          fullPath = '/' + treeNode.name;
        }else {
          fullPath = parentNode.fullpath + '/' + treeNode.name;
        }
        console.log('fullpath set to: ', fullPath);
        console.log('****');
      }

      // Setup an event handler to listen for processed events
      let processedHandler = function(event) {
        // If we catch the event we are pushing, resolve the promise
        winston.log('[Sketches.addTreeNode] processed event caught:', event);
        if( event.token === token) {
          //now that we know the event has been processed, stop listening
          subscriber.stream().removeListener('event_processed', processedHandler);
          resolve({
            nodeId: nodeId,
            tree: subscriber.tree
          });
        }
      }
      subscriber.stream().on('event_processed', processedHandler);

      winston.log('debug', '[Sketches.addTreeNode] recording tree node addition event');
      // Record the tree node addition event
      return Sketches.es.push(userId, sketchId,
        'treenode_added',
        {
          parentId: parentId,
          node: {
            id: nodeId,
            name: treeNode.name,
            fullpath: fullPath,
            data : treeNode.data,
            children: []
          }
        }, token);
    }).catch( e => {
      reject(e);
    })
  });
}

Sketches.prototype.updateBodyData = function(userId, sketchId, nodeId, updateObject, label) {
  return new Promise( (resolve, reject) => {
    // Generate a temporary token to identify the event that we are pushing
    const token = uuidV4();

    // Retrieve a subscriber object (the tree cache is available from the subscriber)
    Sketches.getSubscription(sketchId, label)
    .then( subscriber =>  {
      winston.log('debug', '[Sketches.updateBodyData] subscriber:', subscriber);

      // Validate the request
      if(!subscriber.tree.hash[nodeId]) {
          let errorMessage = 'Cannot update data for non-existent node with ID:' + nodeId;
          reject(new RapidoError(RapidoErrorCodes.fieldValidationError, errorMessage, 400,
            [{
              field: 'nodeId',
              type: 'invalid',
              description: 'There is no node with this ID in this sketch'}]));
          return;
      }
      if(!updateObject || !updateObject.key ) {
        reject('Cannot update data withtout an updateObject argument');
        return;
      }

      // Setup an event handler to listen for processed events
      let processedHandler = function(event) {
        // If we catch the event we are pushing, resolve the promise
        winston.log('[Sketches.updateBodyData] processed event caught:', event);
        if( event.token === token) {
          //now that we know the event has been processed, stop listening
          subscriber.stream().removeListener('event_processed', processedHandler);
          resolve({
            nodeId: nodeId,
            tree: subscriber.tree
          });
        }
      }
      subscriber.stream().on('event_processed', processedHandler);

      winston.log('debug', '[Sketches.updateBodyData] recording tree node response data update event');
      // Record the tree node update event
      return Sketches.es.push(userId, sketchId,
        'treenode_updated_data',
        {
          nodeId: nodeId,
          key: updateObject.key,
          fields: updateObject.fields
        }, token);
    }).catch( e => {
      reject(e);
    })
  });
}

Sketches.prototype.updateNodeDetails = function(userId, sketchId, nodeId, updateObject, label) {
  return new Promise( (resolve, reject) => {
    // Generate a temporary token to identify the event that we are pushing
    const token = uuidV4();

    // Retrieve a subscriber object (the tree cache is available from the subscriber)
    Sketches.getSubscription(sketchId, label)
    .then( subscriber =>  {
      //winston.log('debug', '[Sketches.updateNodeDetails] subscriber:', subscriber);

      // Validate the request
      if(!subscriber.tree.hash[nodeId]) {
          let errorMessage = 'Cannot update response data for non-existent node with ID:' + nodeId;
          reject(new RapidoError(RapidoErrorCodes.fieldValidationError, errorMessage, 400,
            [{
              field: 'nodeId',
              type: 'invalid',
              description: 'There is no node with this ID in this sketch'}]));
          return;
      }
      if(!updateObject ) {
        reject('Cannot update response data without an updateObject argument');
        return;
      }


      // Setup an event handler to listen for processed events
      let processedHandler = function(event) {
        // If we catch the event we are pushing, resolve the promise
        winston.log('[Sketches.updateNodeDetails] processed event caught:', event);
        if( event.token === token) {
          //now that we know the event has been processed, stop listening
          subscriber.stream().removeListener('event_processed', processedHandler);
          resolve({
            nodeId: nodeId,
            tree: subscriber.tree
          });
        }
      }
      subscriber.stream().on('event_processed', processedHandler);

      winston.log('debug', '[Sketches.updateNodeDetails] recording tree node response data update event');
      // Record the tree node update event
      return Sketches.es.push(userId, sketchId,
        'treenode_updated_fields',
        {
          nodeId: nodeId,
          fields: updateObject.fields
        }, token);
    }).catch( e => {
      reject(e);
    })
  });
}

Sketches.prototype.moveNode = function(userId, sketchId, sourceNodeId, targetNodeId, label) {
  return new Promise( (resolve, reject) => {
    // Generate a temporary token to identify the event that we are pushing
    const token = uuidV4();

    // Retrieve a subscriber object (the tree cache is available from the subscriber)
    Sketches.getSubscription(sketchId, label)
    .then( subscriber =>  {
      winston.log('debug', '[Sketches.moveNode] subscriber:', subscriber);

      // Validate the request
      if(!sourceNodeId ) {
        let errorMessage = 'Cannot move undefined node';
        reject(new RapidoError(RapidoErrorCodes.fieldValidationError, errorMessage, 400));
        //reject('Cannot add node to non-existent parent node with ID:' + parentId);
        return;
      }

      if(!targetNodeId ) {
        let errorMessage = 'Cannot move node: a target ID has not been identified';
        reject(new RapidoError(RapidoErrorCodes.fieldValidationError, errorMessage, 400));
        //reject('Cannot add node to non-existent parent node with ID:' + parentId);
        return;
      }

      if( !subscriber.tree.hash[sourceNodeId]  ) {
        let errorMessage = 'Cannot move non-existent node with id: ' + sourceNodeId;
        reject(new RapidoError(RapidoErrorCodes.fieldValidationError, errorMessage, 400,
        [
          {
            field: "sourceNodeId",
            type: "invalid",
            description: "The identified node does not exist."
          }
        ]));
        //reject('Cannot add node to non-existent parent node with ID:' + parentId);
        return;
      }

      if(!subscriber.tree.hash[targetNodeId]) {
        let errorMessage = 'Cannot move node to non-existent target node with ID:' + targetNodeId;
        reject(new RapidoError(RapidoErrorCodes.fieldValidationError, errorMessage, 400,
        [
          {
            field: "targetNodeId",
            type: "invalid",
            description: "The target parent node for this move operation does not exist"
          }
        ]));
        //reject('Cannot add node to non-existent parent node with ID:' + parentId);
        return;
      }

      // Make sure that this move wouldn't result in a circular tree
      // This means we need to walk through all of the children in the source node
      //  and make sure the target id isn't found
      let isChild = function(node, id) {
        if(!node.children) {
          return false;
        }
        for( let i = 0; i< node.children.length; i++ ) {
          let child = node.children[i];
          if( child.id === id ) {
            return true;
          }
          if( isChild(child, id) ) {
            return true;
          }
        }
        return false;
      }

      if(isChild(subscriber.tree.hash[sourceNodeId], targetNodeId)) {
        let errorMessage = 'Unable to move node because it would result in a circular tree.';
        reject(new RapidoError(RapidoErrorCodes.fieldValidationError, errorMessage, 400));
        //reject('Cannot add node to non-existent parent node with ID:' + parentId);
        return;
      }

      // Setup an event handler to listen for processed events
      let processedHandler = function(event) {
        // If we catch the event we are pushing, resolve the promise
        winston.log('[Sketches.moveNode] processed event caught:', event);
        if( event.token === token) {
          //now that we know the event has been processed, stop listening
          subscriber.stream().removeListener('event_processed', processedHandler);
          resolve({
            tree: subscriber.tree
          });
        }
      }
      subscriber.stream().on('event_processed', processedHandler);

      winston.log('debug', '[Sketches.moveNode] recording tree node move event');
      // Record the tree move addition event
      return Sketches.es.push(userId, sketchId,
        'treenode_moved',
        {
          sourceId: sourceNodeId,
          targetId: targetNodeId
        }, token);
    }).catch( e => {
      reject(e);
    })
  });
}

Sketches.prototype.removeNode = function(userId, sketchId, nodeId, label) {
  return new Promise( (resolve, reject) => {
    // Generate a temporary token to identify the event that we are pushing
    const token = uuidV4();

    // Retrieve a subscriber object (the tree cache is available from the subscriber)
    Sketches.getSubscription(sketchId, label)
    .then( subscriber =>  {
      winston.log('debug', '[Sketches.removeNode] subscriber:', subscriber);
      // Validate parameters

      if(!nodeId ) {
        let errorMessage = 'Cannot remove undefined node';
        reject(new RapidoError(RapidoErrorCodes.fieldValidationError, errorMessage, 400));
        //reject('Cannot add node to non-existent parent node with ID:' + parentId);
        return;
      }

      if( !subscriber.tree.hash[nodeId]  ) {
        let errorMessage = 'Unable to delete non-existent node with id: ' + nodeId;
        reject(new RapidoError(RapidoErrorCodes.fieldValidationError, errorMessage, 404));
        //reject('Cannot add node to non-existent parent node with ID:' + parentId);
        return;
      }

      // Setup an event handler to listen for processed events
      let processedHandler = function(event) {
        // If we catch the event we are pushing, resolve the promise
        winston.log('[Sketches.removeNode] processed event caught:', event);
        if( event.token === token) {
          //now that we know the event has been processed, stop listening
          subscriber.stream().removeListener('event_processed', processedHandler);
          resolve({
            tree: subscriber.tree
          });
        }
      }
      subscriber.stream().on('event_processed', processedHandler);

      winston.log('debug', '[Sketches.removeNode] recording tree node move event');
      // Record the tree move addition event
      return Sketches.es.push(userId, sketchId,
        'treenode_deleted',
        {
          nodeId: nodeId
        }, token);
    }).catch( e => {
      reject(e);
    })

  });
}


Sketches.prototype.reset = function() {
  // Used for unit testing, unsubscribes and flushe all subscribers in the cache

  // ** ISSUE: during test runs the cache of subscribers can get out of sync with the actual
  // event listeners.  Reset should clear event listeners no matter what is sitting in the cache

  return new Promise( (resolve, reject) => {

    let eventNames = Sketches.es._emitter().eventNames();
    eventNames.forEach(eventName => {
      winston.log('debug', '[Sketches.reset] eventName before reset:', eventName);
    })

    let keys = Sketches.es._emitter().eventNames();
    keys.forEach( key => {
      winston.log('debug', '[Sketches.reset] removing listener with key ', key)
      Sketches.es.unsubscribeAll(key);
    })

    winston.log('debug', '[Sketches.reset] flushing cache')
    resolve(Sketches.cache.flushAll());

    //let keys = Sketches.cache.keys()

    // let keys = Sketches.es._emitter().eventNames();
    // let sketchesToBeUnsubbed = [];
    // keys.forEach( key => {
    //   sketchesToBeUnsubbed.push(Sketches.cache.get(key));
    // })
    // Promise.all(sketchesToBeUnsubbed)
    // .then( subscribers => {
    //   subscribers.forEach(subscriber => {
    //     if( !subscriber ) {
    //       debugger;
    //       winston.log('warn', '[Sketches.reset] expected to find a subscriber but got null value instead');
    //     }
    //     let sketchId = subscriber.getSketchID();
    //     winston.log('debug', '[Sketches.reset] removing subscriber for sketch ID: ', sketchId);
    //     winston.log('debug', '[Sketches.reset] subscriber to be removed:', subscriber);
    //     Sketches.es.unsubscribe(sketchId, subscriber.onEvent);
    //     let eventNames = Sketches.es._emitter().eventNames();
    //     if( Sketches.es._emitter().eventNames().length > 0 ) {
    //       eventNames.forEach(eventName => {
    //         winston.log('debug', '[Sketches.reset] subsribers listening to eventsource after unsub: ', eventName);
    //       })
    //     }
    //   })
    //   winston.log('debug', '[Sketches.reset] flushing cache')
    //   resolve(Sketches.cache.flushAll());
    // })

  })
}

Sketches.prototype.getEventStore = function() {
  return Sketches.es;
}

module.exports = new Sketches();
