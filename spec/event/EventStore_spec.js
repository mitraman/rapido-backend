"use strict";

var EventStore = require('../../src/event/EventStore.js');
var config = require('../../src/config.js');
const dataAccessor = require('../../src/db/DataAccessor.js');
const SketchEventStream = require('../../src/event/SketchEventStream.js');
const Promise = require('bluebird');
const winston = require('winston');

describe('EventStore ', function() {

  let sketchId = 10;

  beforeEach(function(done) {
    //let es = new EventStore();
    //es.clearAllStreams();
    winston.log('debug', 'deleting all event data from database');
    // remove the event history before each test
    const db = dataAccessor.getDb();
    db.query('delete from sketchevents;')
    .then( () => {
    }).finally(done);
  })

  it('should store an event', function(done) {
    let es = new EventStore();

    let newEvent = { data: 'blah blah' };
    let eventType = 'test_type';

    es.push(sketchId, eventType, newEvent)
    .then( (result) => {
      expect(result.id).not.toBeUndefined();
    }).catch( (error) => {
      fail(error);
    }).finally(done)
  })

  it('should provide a readable event stream of all new events', function(done) {
    let es = new EventStore();
    let eventCount = 0;

    es.subscribe(sketchId, (event) => {
      eventCount++;
      if( eventCount === 3 ) {
        done();
      }
    })

     es.push(sketchId, 'test_event', { eventId: 'test', testname: 'stream-test-1' })
     es.push(sketchId, 'test_event',{ eventId: 'test', testname: 'stream-test-1' })
     es.push(sketchId, 'test_event',{ eventId: 'test', testname: 'stream-test-1' })
  })


  it('should provide a readable event stream of new events for a particular sketch ID', function(done) {
    let es = new EventStore();
    let eventCount = 0;

    es.subscribe(sketchId, (event) => {
      eventCount++;
      expect(event.type).toBe('good');
      if( eventCount === 2 ) {
        done();
      }
    }, 0);

    es.push(sketchId, 'good',{ eventId: 'test', type:'good', testname: 'stream-test-1' })
    es.push(0, 'bad',{ eventId: 'test', type: 'bad', testname: 'stream-test-1' })
    es.push(sketchId, 'good',{ eventId: 'test', type: 'good', testname: 'stream-test-1' })

  })

  it('should provide a history of events if an index is specified', function(done) {
    let es = new EventStore();

    let events = [];
    const numEvents = 100;
    for( let i = 0; i < numEvents; i++ ) {
      events.push(es.push(sketchId, 'pre', { eventId: i, type: 'pre'}));
    }

    let eventCount = 0;
    let eventHandler = function(event) {
      if( eventCount < numEvents ) {
        expect(event.type).toBe('pre');
      }
      eventCount++;
      if( eventCount === numEvents ) {
        // Push a new event to make sure we can receive it
        es.push(sketchId, 'post', { type: 'post'})
      } else if( eventCount > numEvents ) {
        // Make sure we received the new event.
        expect(event.type).toBe('post');
        done();
      }
    }

    // Subscribe to the sketch event stream
    es.subscribe(sketchId, eventHandler, 0);

    // Fire the events
    //Promise.all(events);
    Promise.reduce(events, function(success, result) {
      return new Promise( (resolve,reject) => {
        resolve();
      })
    })
  })

  it('should transmit a client specified token when emitting an event', function(done) {
    let es = new EventStore();
    let token = 'test-token';

    let eventHandler = function(event) {
      expect(event.token).toBe(token);
      done();
    }

    es.subscribe(sketchId, eventHandler);
    es.push(sketchId, 'test', { name: 'test-event'}, token);

  })

  it('should support many events being fired at the same time', function(done) {
    let es = new EventStore();

    let events = [];
    const numEvents = 50;
    for( let i = 0; i < numEvents; i++ ) {
      events.push(es.push(sketchId, 'pre', { eventId: i, type: 'pre'}));
    }

    let eventCount = 0;
    let eventHandler = function(event) {
      eventCount++;
      if( eventCount >= numEvents ) {
        done();
      }
    }

    // Subscribe to the sketch event stream
    es.subscribe(sketchId, eventHandler, 0);

    // Fire the events
    Promise.all(events);
  })

  it('should only send events to a matching listener', function(done) {
    let es = new EventStore();
    const wrongSketchId = 200;

    let eventHandler = function(event) {
      expect(event.data.sketchId).toBe(sketchId);
      done();
    }

    let wrongHandler = function(event) {
      fail('this stream should not have been called.');
    }

    es.subscribe(sketchId, eventHandler);
    es.subscribe(wrongSketchId, wrongHandler);

    es.push(sketchId, 'test_event', { sketchId: sketchId});
  })

  it('should stop sending events when a listener unsubscribes', function(done) {
    let es = new EventStore();

    let handlerSpy = jasmine.createSpy('handlerSpy')

    es.subscribe(sketchId, handlerSpy);
    es.push(sketchId, 'test_event', { sketchId: sketchId, test: 'subscribed'})
    .then( () => {
        return es.unsubscribe(sketchId, handlerSpy);
    }).then( () => {
        return es.push(sketchId, 'test_event', { sketchId: sketchId, test: 'unsubscribed'});
    }).then( () => {
        expect(handlerSpy.calls.count()).toBe(1);
    }).catch( e => fail(e)).finally(done)



  })

});
