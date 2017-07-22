"use strict";

const winston = require('winston');
const Promise = require('bluebird');
const TreeEventProcessor = require('./TreeEventProcessor');
const DirectedGraphEventProcessor = require('./DirectedGraphEventProcessor');

let EventProcessor = function () {
};

EventProcessor.prototype.applyEvent = function(event, graph) {
  return new Promise( (resolve,reject) => {
    winston.log('debug', '[EventProcessor.applyEvent]  handling event: ', event);
    if( !event.type ) {
      reject('event object is malformed');
    }

    if( event.type.startsWith('tree')) {
      if( !TreeEventProcessor[event.type]) {
        reject('unable to handle an unknown event type: ' + event.type);
      } else {
        // Apply the function
        try {
          winston.log('debug', '[EventProcessor.applyTreeEvent] processing event.id:', event.id)
          let updatedTree = TreeEventProcessor[event.type](event, graph);
          resolve({tree: updatedTree, event: event});
        }catch(e) {
          let errorMessage = '(eventID: ' + event.id + ') ' + e.message;
          e.message = errorMessage;
          reject(e);
        }
      }
    }else if( event.type.startsWith('graph')) {
      if( !GraphEventProcessor[event.type]) {
        reject('unable to handle an unknown event type: ' + event.type);
      } else {
        // Apply the function
        try {
          winston.log('debug', '[EventProcessor.applyTreeEvent] processing event.id:', event.id)
          resolve(GraphEventProcessor[event.type](event, graph));
        }catch(e) {
          reject(e);
        }
      }
    }else {
      console.log('unknown event type');
        reject('unable to handle an unknown event type: ' + event.type);
    }
  })
}


module.exports = new EventProcessor();
