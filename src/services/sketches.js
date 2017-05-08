"use strict";

const EventStore = require('../event/EventStore.js');
const winston = require('winston');
const uuidV4 = require('uuid/v4');
const Cache = require('./Cache.js');
const TreeEventSubscription = require('../event/TreeEventSubscription.js')
const treeEventProcessor = require('../../src/event/TreeEventProcessor.js');
const Promise = require('bluebird');
const RapidoError = require('../errors/rapido-error.js');
const RapidoErrorCodes = require('../errors/codes.js');


let Sketches = function () {
  winston.log('debug', 'in Sketches constructor');
  Sketches.cache = new Cache();
  Sketches.es = new EventStore();
  Sketches.eventSubscriptions = {};
};

Sketches.getSubscription = function(sketchId, label) {
  return new Promise( (resolve, reject) => {
    // Retrieve a subscriber object (the tree cache is available from the subscriber)
    Sketches.cache.get(sketchId)
    .then( subscriber => {
      // if we don't already have a subscriber, create and store one
      if( !subscriber) {
        winston.log('debug', '[Sketches.getSubscription] No subscriber found in cache, creating a new subscription');

        // Create a new subscriber object
        subscriber = new TreeEventSubscription(sketchId, treeEventProcessor, label);

        Sketches.es.subscribe(sketchId, subscriber.onEvent, 0);

        winston.log('debug', '[Sketches.getSubscription] storing subscription: ', subscriber);
        // Store the subscription in cache
        Sketches.cache.set(sketchId, subscriber);
      }else {
        winston.log('debug', '[Sketches.getSubscription] An existing subscriber was retrieved form cache: ', subscriber);
        winston.log('debug', '[Sketches.getSubscription] lastEventIDProcessed:', subscriber.getLastEventID());
      }
      resolve(subscriber);
    })
  });
}

Sketches.prototype.getTree = function(sketchId, label) {
  winston.log('debug','[Sketches.getTree] invoked');
  // Get the most recent version of the tree by checking for the last event
  // recorded for this sketch.
  return new Promise( (resolve, reject) => {
    Sketches.getSubscription(sketchId, label)
    .then( subscription => {
      winston.log('debug', '[Sketches.getTree] cached tree:', subscription.tree);
      resolve({tree:subscription.tree});
    })

  })
}

Sketches.prototype.addTreeNode = function(sketchId, treeNode, parentId, label) {
  return new Promise( (resolve, reject) => {
    // Generate a unique ID for the new node
    const nodeId = uuidV4();

    // Generate a temporary token to identify the event that we are pushing
    const token = uuidV4();

    // Retrieve a subscriber object (the tree cache is available from the subscriber)
    Sketches.getSubscription(sketchId, label)
    .then( subscriber =>  {
      winston.log('debug', '[Sketches.addTreeNode] subscriber:', subscriber);

      // Validate the request
      if(parentId) {
        if(!subscriber.tree.hash[parentId]) {
          let errorMessage = 'Cannot add node to non-existent parent node with ID:' + parentId;
          reject(new RapidoError(RapidoErrorCodes.invalidField, errorMessage, 400));
          //reject('Cannot add node to non-existent parent node with ID:' + parentId);
          return;
        }
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
      return Sketches.es.push(sketchId,
        'treenode_added',
        {
          parentId: parentId,
          node: {
            id: nodeId,
            name: treeNode.name,
            fullpath: treeNode.fullpath,
            responseData : treeNode.responseData,
            children: []
          }
        }, token);
    }).catch( e => {
      reject(e);
    })
  });
}

Sketches.prototype.updateResponseData = function(sketchId, nodeId, updateObject, label) {
  return new Promise( (resolve, reject) => {
    // Generate a temporary token to identify the event that we are pushing
    const token = uuidV4();

    // Retrieve a subscriber object (the tree cache is available from the subscriber)
    Sketches.getSubscription(sketchId, label)
    .then( subscriber =>  {
      winston.log('debug', '[Sketches.updateResponseData] subscriber:', subscriber);

      // Validate the request
      if(!subscriber.tree.hash[nodeId]) {
          reject('Cannot update response data for non-existent node with ID:' + nodeId);
          return;
      }
      if(!updateObject || !updateObject.key ) {
        reject('Cannot update response data withtout an updateObject argument');
        return;
      }


      // Setup an event handler to listen for processed events
      let processedHandler = function(event) {
        // If we catch the event we are pushing, resolve the promise
        winston.log('[Sketches.updateResponseData] processed event caught:', event);
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

      winston.log('debug', '[Sketches.updateResponseData] recording tree node response data update event');
      // Record the tree node update event
      return Sketches.es.push(sketchId,
        'treenode_updated_responsedata',
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

Sketches.prototype.updateNodeDetails = function(sketchId, nodeId, updateObject, label) {
  return new Promise( (resolve, reject) => {
    // Generate a temporary token to identify the event that we are pushing
    const token = uuidV4();

    // Retrieve a subscriber object (the tree cache is available from the subscriber)
    Sketches.getSubscription(sketchId, label)
    .then( subscriber =>  {
      //winston.log('debug', '[Sketches.updateNodeDetails] subscriber:', subscriber);

      // Validate the request
      if(!subscriber.tree.hash[nodeId]) {
          reject('Cannot update response data for non-existent node with ID:' + nodeId);
          return;
      }
      if(!updateObject ) {
        reject('Cannot update response data withtout an updateObject argument');
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
      return Sketches.es.push(sketchId,
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

Sketches.prototype.reset = function() {
  // Used for unit testing, unsubscribes and flushe all subscribers in the cache

  return new Promise( (resolve, reject) => {

    let keys = Sketches.cache.keys()
    let sketchesToBeUnsubbed = [];
    keys.forEach( key => {
      sketchesToBeUnsubbed.push(Sketches.cache.get(key));
    })
    Promise.all(sketchesToBeUnsubbed)
    .then( subscribers => {
      subscribers.forEach(subscriber => {
        let sketchId = subscriber.getSketchID();
        winston.log('debug', '[Sketches.reset] removing subscriber for sketch ID: ', sketchId);
        winston.log('debug', '[Sketches.reset] subscriber to be removed:', subscriber);
        Sketches.es.unsubscribe(sketchId, subscriber.onEvent);
      })
      winston.log('debug', '[Sketches.reset] flushing cache')
      resolve(Sketches.cache.flushAll());
    })
  })
}

module.exports = new Sketches();
