"use strict";

const winston = require('winston');
const dataAccessor = require('../db/DataAccessor.js');
const Promise = require('bluebird');
const SketchEventStream = require('./SketchEventStream.js');

let EventStore = function () {
  winston.log('debug', 'EventStore Constructor called');
  EventStore.eventEmitter = new SketchEventStream();
  console.log('************** FIX THIS CODE : DB SHOULD BE A PROPERTY OF THIS FUNCTION OBJECT');
};

EventStore.prototype.push = function (sketchId, eventType, newEvent, token) {
  //winston.log('debug', 'eventstreams:', eventStreams);
  let db = dataAccessor.getDb();
  winston.log('debug', '[EventStore.push] invoked for sketch ' + sketchId  +' with event:', newEvent);
  return new Promise(function(resolve, reject) {
    // Store the event in the database
    let jsonData = JSON.stringify(newEvent);
    db.one('INSERT INTO sketchevents (sketchid, eventtype, eventdata) VALUES ($1, $2, $3) RETURNING ID', [sketchId, eventType, jsonData])
    .then( data => {
      winston.log('debug', '[EventStore.push] stored event: ', newEvent);
      resolve({
        id: data.id
      });

      let event = {
        id: data.id,
        type: eventType,
        data: newEvent,
        token: token
      }
      // Emit to event listeners
      winston.log('debug', '[EventStore.push] listener count for ' + sketchId + ' events is : ' + EventStore.eventEmitter.listenerCount(sketchId));
      let status = EventStore.eventEmitter.emit(sketchId, event);
    }).catch( error => {
      reject(error);
    })
  })
}

// Load all stored events from the database and emit them
let emitHistoricalEvents = function(emitter, sketchId, startIndex ) {
  let db = dataAccessor.getDb();

  db.manyOrNone('SELECT id, eventtype, eventdata FROM sketchevents WHERE id >= $1 AND sketchid = $2', [startIndex, sketchId])
  .then( results => {
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
  let db = dataAccessor.getDb();
  winston.log('debug', '[EventStore.subscribed] retrieving information about historical events for sketch id:', sketchId);

  return new Promise( (resolve, reject) => {
    let history = [];
    db.manyOrNone('SELECT id, eventtype, eventdata from sketchevents where sketchid = $1', [sketchId])
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
  let db = dataAccessor.getDb();

  return new Promise ( (resolve, reject) => {
    db.oneOrNone('SELECT id from sketchevents where sketchid = $1 order by createdat desc limit 1', [sketchId])
    .then( result => {
      winston.log('debug', '[EventStore.getLastEventID] db query returned: ', result);
      resolve((result ? result.id : null));
    })
  })
}


EventStore.prototype.subscribe = function(sketchId, listener, startIndex) {
  winston.log('debug', '[EventStore.subscribed] adding listener for sketch ID:', sketchId);

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

EventStore.prototype._emitter = function() {
  return EventStore.eventEmitter;
}

module.exports = EventStore;
