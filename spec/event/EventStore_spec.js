"use strict";

var EventStore = require('../../src/event/EventStore.js');
var config = require('../../src/config.js');
const dataAccessor = require('../../src/db/DataAccessor.js');
const SketchEventStream = require('../../src/event/SketchEventStream.js');
const Promise = require('bluebird');
const winston = require('winston');

describe('EventStore ', function() {

  beforeAll(function() {
    this.es = new EventStore();
    this.sketchId = 10;
  })

  beforeEach(function(done) {
    dataAccessor.getDb().query('delete from sketchevents').finally(done);
  })

  afterEach(function() {
    this.es.unsubscribeAll(this.sketchId);
  })

  // TODO: Need to solve the problem of mocking the database
  // right now it doesn't work
  xit('should store an event', function(done) {

    let newEvent = { data: 'blah blah' };
    let eventType = 'test_type';

    // Stub the database for this test so we don't have to wait for
    // the event to process
    this.queryValidator = (query, params) => {
      console.log('queryValidator called');
      expect(params[0]).toBe(this.sketchId);
      done();
      return new Promise( (resolve,reject) => { resolve(1); })
    }


    spyOn(dataAccessor.getDb(), 'one').and.callFake( (query, params) => {
      console.log('in it');
    })

    // spyOn(dataAccessor, 'getDb').and.callFake( () => {
    //   console.log('getDb called');
    //   return {
    //     one: this.queryValidator
    //   }
    // })

    this.es.push(this.sketchId, eventType, newEvent)
    .then( (queueLength) => {
      expect(queueLength).toBe(1);
    }).catch( (error) => {
      fail(error);
    });
  })

  it('should provide a readable event stream of all new events', function(done) {
    let eventCount = 0;

    this.es.subscribe(this.sketchId, (event) => {
      eventCount++;
      if( eventCount === 3 ) {
        done();
      }
    })

     this.es.push(this.sketchId, 'test_event', { eventId: 'test', testname: 'stream-test-1' })
     this.es.push(this.sketchId, 'test_event',{ eventId: 'test', testname: 'stream-test-1' })
     this.es.push(this.sketchId, 'test_event',{ eventId: 'test', testname: 'stream-test-1' })
  })


  it('should provide a readable event stream of new events for a particular sketch ID', function(done) {
    let eventCount = 0;

    this.es.subscribe(this.sketchId, (event) => {
      eventCount++;
      expect(event.type).toBe('good');
      if( eventCount === 2 ) {
        expect(event.data.eventId).toBe('last-event');
        done();
      }
    }, 0);

    this.es.push(this.sketchId, 'good',{ eventId: 'test', type:'good', testname: 'stream-test-1' })
    this.es.push(0, 'bad',{ eventId: 'test', type: 'bad', testname: 'stream-test-1' })
    this.es.push(this.sketchId, 'good',{ eventId: 'last-event', type: 'good', testname: 'stream-test-1' })

  })

  it('should provide a history of events if an index is specified', function(done) {
    const numEvents = 100;
    let eventCount = 0;

    let eventHandler = event => {
      if( eventCount < numEvents ) {
        expect(event.type).toBe('pre');
      }
      eventCount++;
      if( eventCount === numEvents ) {
        // Push a new event to make sure we can receive it
        this.es.push(this.sketchId, 'post', { type: 'post'})
      } else if( eventCount > numEvents ) {
        // Make sure we received the new event.
        expect(event.type).toBe('post');
        done();
      }
    }

    // Subscribe to the sketch event stream
    this.es.subscribe(this.sketchId, eventHandler, 0);

    let eventData = []
    for( let i = 0; i < numEvents; i++ ) {
      eventData.push({id: i})
    }

  Promise.reduce(eventData, (accumulator, eventInfo) => {
      return this.es.push(this.sketchId, 'pre', { eventId: eventInfo.id, type: 'pre'});
    }, 0).then( acc => {
      winston.log('debug', 'Finished firing events');
    })
  })

  it('should transmit a client specified token when emitting an event', function(done) {
    let token = 'test-token';

    let eventHandler = function(event) {
      expect(event.token).toBe(token);
      done();
    }

    this.es.subscribe(this.sketchId, eventHandler);
    this.es.push(this.sketchId, 'test', { name: 'test-event'}, token);

  })

  it('should support many events being fired at the same time', function(done) {

    let events = [];
    const numEvents = 50;
    for( let i = 0; i < numEvents; i++ ) {
      events.push(this.es.push(this.sketchId, 'pre', { eventId: i, type: 'pre'}));
    }

    let eventCount = 0;
    let eventHandler = function(event) {
      eventCount++;
      if( eventCount >= numEvents ) {
        done();
      }
    }

    // Subscribe to the sketch event stream
    this.es.subscribe(this.sketchId, eventHandler, 0);

    // Fire the events
    Promise.all(events);
  })

  it('should only send events to a matching listener', function(done) {
    const wrongSketchId = 200;

    let eventHandler = (event) => {
      expect(event.data.sketchId).toBe(this.sketchId);
      this.es.unsubscribeAll(wrongSketchId);
      done();
    }

    let wrongHandler = function(event) {
      fail('this stream should not have been called.');
    }

    this.es.subscribe(this.sketchId, eventHandler);
    this.es.subscribe(wrongSketchId, wrongHandler);

    this.es.push(this.sketchId, 'test_event', { sketchId: this.sketchId});

  })

  //TODO: need to update this test case - with new es.push behaviour, it returns
  // imeediately.  But, this test case assumes that the push has been writtten
  // to db and procesed first.
  xit('should stop sending events when a listener unsubscribes', function(done) {

    let handlerSpy = jasmine.createSpy('handlerSpy')

    this.es.subscribe(this.sketchId, handlerSpy);
    this.es.push(this.sketchId, 'test_event', { sketchId: this.sketchId, test: 'subscribed'})
    .then( () => {
        return this.es.unsubscribe(this.sketchId, handlerSpy);
    }).then( () => {
        return this.es.push(this.sketchId, 'test_event', { sketchId: this.sketchId, test: 'unsubscribed'});
    }).then( () => {
        expect(handlerSpy.calls.count()).toBe(1);
    }).catch( e => fail(e)).finally(done)



  })

});
