"use strict";

const winston = require('winston');
const dataAccessor = require('../db/DataAccessor.js');
const Promise = require('bluebird');

let subscribers = [];
let db;

let notify = function(subscriber, event, eventId) {
  if( !subscriber.match || subscriber.match(event) ) {
    subscriber.callback( {
      id: eventId,
      event: event
    });
  }
}

var EventStore = function () {
  //winston.log('debug', 'in constructor');
  db = dataAccessor.getDb();
};

EventStore.prototype.push = function (newEvent) {
  winston.log('debug', 'Event pushed');
  return new Promise(function(resolve, reject) {
    // Store the event in the database
    db.one('INSERT INTO events (eventdata) VALUES ($1) RETURNING ID', [newEvent])
    .then( data => {
      resolve({
        id: data.id
      });

      // Process filters and make notifications
      subscribers.forEach( (subscriber) => {
        notify(subscriber, newEvent, data.id);
      })

    }).catch( error => {
      reject(error);
    })
  })
}

EventStore.prototype.subscribe = function( callback, match, startIndex ) {
  winston.log('debug','adding subscriber');
  let subscriber = {
    match: match,
    callback: callback
  }
  subscribers.push(subscriber);

  db.manyOrNone('SELECT * FROM events WHERE id >= $1', [startIndex])
  .then( result => {
    //console.log(result);
    result.forEach( result => {
      notify(subscriber, result.eventdata, result.id );
    })
  })
/*
  if( startIndex && startIndex < events.length ) {
    for( let i = startIndex; i < events.length; i++ ) {
      notify(subscriber, events[i], i);
    }
  }
  */
}

EventStore.prototype.removeAllSubscribers = function() {
  winston.log('debug', 'removing all event store subscribers');
  // Removes all subscribers
  subscribers = [];
}

module.exports = EventStore;
