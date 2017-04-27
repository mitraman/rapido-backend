"use strict";

const winston = require('winston');

var EventStore = function () {
  //winston.log('debug', 'in constructor');
};

let subscribers = [];
let events = [];

let notify = function(subscriber, event, eventId) {
  if( !subscriber.match || subscriber.match(event) ) {
    subscriber.callback( {
      id: eventId,
      event: event
    });
  }
}

EventStore.prototype.push = function (newEvent) {
  winston.log('debug', 'Event pushed');
  return new Promise(function(resolve, reject) {
    let id = events.push(newEvent)-1;
    resolve({
      id: id
    })

    // Process filters and make notifications
    subscribers.forEach( (subscriber) => {
      notify(subscriber, newEvent, id);
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
  if( startIndex && startIndex < events.length ) {
    for( let i = startIndex; i < events.length; i++ ) {
      notify(subscriber, events[i], i);
    }
  }
}

EventStore.prototype.removeAllSubscribers = function() {
  winston.log('debug', 'removing all event store subscribers');
  // Removes all subscribers
  subscribers = [];
}

module.exports = EventStore;
