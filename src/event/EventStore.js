"use strict";

const winston = require('winston');
const dataAccessor = require('../db/DataAccessor.js');
const Promise = require('bluebird');
const SketchEventStream = require('./SketchEventStream.js');

let EventStore = function () {
  winston.log('debug', 'EventStore Constructor called');
  EventStore.eventEmitter = new SketchEventStream();
  //TODO: This queue should be replaced by a faster one.  Array.shift() is slow.
  EventStore.eventQueue = [];
  EventStore.db = dataAccessor.getDb();
};

// Useful for test cases, allows a client to replace the database instance that the event store is using
EventStore.prototype.setDataBase = function(database) {
  EventStore.db = database;
}


EventStore.processNextEvent = function() {
  winston.log('debug', '[EventStore.processNextEvent] setting isProcessorRunning to true');
  EventStore.isProcessorRunning = true;

  // Grab the first event in the queue.
  let eventObject = EventStore.eventQueue.shift();
  if( !eventObject ) {
    winston.log('debug', '[EventStore.processNextEvent] no events left in queue.');
    EventStore.isProcessorRunning = false;
    return;
  }

  let userId = eventObject.userId;
  let sketchId = eventObject.sketchId;
  let eventType = eventObject.eventType;
  let newEvent = eventObject.event;
  let token = eventObject.token;

  //let db = dataAccessor.getDb();
  winston.log('debug', '[EventStore.processNextEvent] for sketch '
    + sketchId  +' with event:', newEvent);
  let jsonData = JSON.stringify(newEvent);
  EventStore.db.one('INSERT INTO sketchevents (userid, sketchid, eventtype, eventdata) VALUES ($1, $2, $3, $4) RETURNING ID', [userId, sketchId, eventType, jsonData])
  .then( data => {
    winston.log('debug', '[EventStore.processNextEvent] stored event: ', newEvent);

    let event = {
      id: data.id,
      type: eventType,
      data: newEvent,
      token: token
    }
    winston.log('debug', 'listeners:', EventStore.eventEmitter.listeners(sketchId));

    // Emit to event listeners
    winston.log('debug', '[EventStore.processNextEvent] listener count for '
      + sketchId + ' events is : ' + EventStore.eventEmitter.listenerCount(sketchId));
    let status = EventStore.eventEmitter.emit(sketchId, event);

    // try to process the next event
    EventStore.processNextEvent();
  }).catch( error => {
    winston.log('error', '[EventStore.processNextEvent] an error occurred: ', error);
  })



}
// Pushes an event onto the event store queue for processing as soon as possible
EventStore.prototype.push = function (userId, sketchId, eventType, newEvent, token) {
  winston.log('debug', '[EventStore.push] called with event:', newEvent);
  return new Promise( (resolve,reject) => {
    EventStore.eventQueue.push({
      userId: userId,
      sketchId: sketchId,
      eventType: eventType,
      event: newEvent,
      token: token
    });

    winston.log('debug', '[EventStore.push] eventQueue.length:', EventStore.eventQueue.length);
    resolve(EventStore.eventQueue.length);

    winston.log('debug', '[EventStore.push] isProcessorRunning:', EventStore.isProcessorRunning);
    if( !EventStore.isProcessorRunning ) {
      // Kick off the event processor if it isn't running
      winston.log('debug', '[EventStore.push] starting event queue processor');
      EventStore.processNextEvent();
    }
  });
}

// Load all stored events from the database and emit them
let emitHistoricalEvents = function(emitter, sketchId, startIndex ) {
  //let db = dataAccessor.getDb();

  winston.log('debug', '[EventStore.emitHistoricalEvents] checking for historical records');

  EventStore.db.manyOrNone('SELECT id, eventtype, eventdata FROM sketchevents WHERE id >= $1 AND sketchid = $2 ORDER BY id ASC', [startIndex, sketchId])
  .then( results => {
    //winston.log('debug', '&&&& results:', results);
    winston.log('debug', '[EventStore.emitHistoricalEvents] number of historical events found:', results.length);
    for( let i = 0; i < results.length; i++ ) {
      winston.log('debug', 'emitting historical event:', results[i]);
      let eventData = JSON.parse(results[i].eventdata);
      emitter._emit(sketchId,
        {
          id: results[i].id,
          type: results[i].eventtype,
          data: eventData
        });
    }
    winston.log('debug', '[EventStore.emitHistoricalEvents] Historical events emitted, putting stream in ready state for future events.');
    // Put the emitter in ready state
    emitter.ready();

  });
}

EventStore.prototype.getHistory = function(sketchId) {
  //let db = dataAccessor.getDb();
  winston.log('debug', '[EventStore.subscribed] retrieving information about historical events for sketch id:', sketchId);

  return new Promise( (resolve, reject) => {
    let history = [];
    EventStore.db.manyOrNone('SELECT id, eventtype, eventdata from sketchevents where sketchid = $1', [sketchId])
    .then( results => {
      results.forEach(result => {
        history.push({
          id: result.id,
          type: result.eventtype
        });
      })
      resolve(history);
    })
  })
}


EventStore.prototype.getLastEventID = function( sketchId ) {
  //let db = dataAccessor.getDb();

  return new Promise ( (resolve, reject) => {
    EventStore.db.oneOrNone('SELECT id from sketchevents where sketchid = $1 order by createdat desc limit 1', [sketchId])
    .then( result => {
      winston.log('debug', '[EventStore.getLastEventID] db query returned: ', result);
      resolve((result ? result.id : null));
    })
  })
}


EventStore.prototype.subscribe = function(sketchId, listener, startIndex) {
  winston.log('debug', '[EventStore.subscribe] adding listener for sketch ID:', sketchId);
  winston.log('debug', '[EventStore.subscribe] startIndex:', startIndex);
  //EventStore.eventEmitter.on(sketchId, event => listener);
  EventStore.eventEmitter.on(sketchId, listener);

  if( startIndex != null) {
    emitHistoricalEvents(EventStore.eventEmitter, sketchId, startIndex);
  }else {
    EventStore.eventEmitter.ready();
  }

}

EventStore.prototype.unsubscribe = function(sketchId, listener) {
  //Logging the listener causes the listener to be called. So don't uncomment this unless absolutely necessary
  //winston.log('debug', '[EventStore.unsubscribe] removing listener from event subscription: ', listener);
  EventStore.eventEmitter.removeListener(sketchId, listener);
}


// Used for supporting unit tests
EventStore.prototype.unsubscribeAll = function(sketchId) {
  EventStore.eventEmitter.removeAllListeners(sketchId);
}

EventStore.prototype._emitter = function() {
  return EventStore.eventEmitter;
}

module.exports = EventStore;
