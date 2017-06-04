"use strict";

const winston = require('winston');
const dataAccessor = require('../db/DataAccessor.js');
const Promise = require('bluebird');
const SketchEventStream = require('./SketchEventStream.js');
const EventEmitter = require('events');

class EventSubscription {
  constructor(sketchId, processor, name) {
    this.sketchId = sketchId;
    this.eventProcessor = processor;
    this.emitter = new EventEmitter();
    this.tree = {
      hash: {},
      rootNodes: []
    };
    this.lastEventIDProcessed = -1;
    this.eventQueue = [];

    // Bind the onEvent method so that we have access to this (Node EventEmitter tries to use its own this context)
    this.onEvent = this.onEvent.bind(this);

    //FOR debug
    this.name = name;
  }

  onEvent(event) {
    winston.log('debug', '[EventSubscription.onEvent] (' + this.name + ') received an event:', event);

    if( !event ) {
      // null events may be recieved if another module tries to write the event handler to a log message
      winston.log('warn', '[EventSubscription.onEvent] null event recieved - is someone trying to print the eventHandler in a log message?');
      return;
    }

    // This event should be newer than the last event processed - if not, something has gone wrong
    if( event.id <= this.lastEventIDProcessed ) {
      winston.log('error',
      '[EventSubscription.onEvent] An event has been recieved that is older or the same as the last event id of ' + this.lastEventIDProcessed
      +' : ', event);
      return;
    }

    winston.log('info', '[EventSubscription.onEvent] adding event to an event queue with length of', this.eventQueue.length);
    // add the event to the queue
    this.eventQueue.push(event);


    let processEventQueue = function() {
      winston.log('debug', '[EventSubscription.onEvent] calling treeEventProcessor with tree:', this.tree);

      let queuedEvent = this.eventQueue.shift();

      // Apply the event
      this.eventProcessor.applyEvent(queuedEvent, this.tree)
      .then( (updatedTree) => {
        winston.log('debug', '[EventSubscription.onEvent] event processed succesfully.  tree result:', updatedTree);
        // store the state of the tree
        this.tree = updatedTree;

        // Update the last event processed for this sketch
        this.lastEventIDProcessed = queuedEvent.id;
        winston.log('debug', '[EventSubscription.onEvent] ('+this.name+') event_processed event listeners: ', this.emitter.listenerCount('event_processed') );
        winston.log('debug', '[EventSubscription.onEvent] emitting event_processed event to listeners for event ID ', queuedEvent.id);
        // Alert any subscribers to our event stream that this event has been completely processed
        this.emitter.emit('event_processed', queuedEvent);

      }).catch( e => {
        // If we hit an error, there isn't much we can do except to log it
        winston.log('error', '[EventSubscription.onEvent] (event:' + queuedEvent + ') unexpected error:', e);
      }).finally( () => {
        if( this.eventQueue.length > 0 ) {
          processEventQueue();
        }
      })
    }.bind(this);

    // recursively process all events in the queue (the queue may mutate while promises are called)
    processEventQueue()

  }

  getSketchID() {
    return this.sketchId;
  }

  getLastEventID() {
    return this.lastEventIDProcessed;
  }

  stream() {
    return this.emitter;
  }


}

module.exports = EventSubscription;
