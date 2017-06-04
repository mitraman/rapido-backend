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
      console.log(TreeEventProcessor);
      if( !TreeEventProcessor[event.type]) {
        reject('unable to handle an unknown event type: ' + event.type);
      } else {
        // Apply the function
        try {
          winston.log('debug', '[EventProcessor.applyTreeEvent] processing event.id:', event.id)
          resolve(TreeEventProcessor[event.type](event, graph));
        }catch(e) {
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
        reject('unable to handle an unknown event type: ' + event.type);
    }
  })
}


module.exports = new EventProcessor();
