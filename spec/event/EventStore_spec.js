"use strict";

var EventStore = require('../../src/event/EventStore.js');
var config = require('../../src/config.js');

describe('EventStore ', function() {

  beforeEach(function() {
    let es = new EventStore();
    es.removeAllSubscribers();
  })

  it('should store an event', function(done) {
    let es = new EventStore();
    let newEvent = {
      eventId: 'uuid-eventid',
      type: 'add-node-event',
      data: {
        sketch: 12332,
        user: 12,
        node: {
          parent: 23,
          name: '/bleh',
          path: '/api/bleh',
          responseData: {
            'GET': {
              contentType: 'application/json',
              data: ''
            }
          }
        }
      }
    }
    es.push(newEvent)
    .then( (result) => {
      expect(result.id).not.toBeUndefined();
      done();
    }).catch( (error) => {
      fail(error);
    })
  })

  it('should call a callback function when an event is added', function(done) {
    let es = new EventStore();

    es.subscribe((eventReceived)=> {
      expect(eventReceived.id).not.toBeUndefined();
      expect(eventReceived.event.data.index).toBe(1);
      done();
    })

    es.push({
        eventId: 'id-1',
        type: 'testing',
        data: {
          index: 1
        }
    });

  })

  it('should call a callback function when events are added', function(done) {
    let es = new EventStore();

    const numberOfEvents = 10;
    let numberOfEventsReceived = 0;

    es.subscribe((eventReceived)=> {
      expect(eventReceived.id).not.toBeUndefined();
      expect(eventReceived.event.data.index).toBe(numberOfEventsReceived);
      numberOfEventsReceived++;
      if(numberOfEventsReceived === numberOfEvents) {
        done();
      }
    })

    for( let i = 0; i < numberOfEvents; i++ ) {
      es.push({
        eventId: 'id-1',
        type: 'testing',
        data: {
          index: i
        }
      });
    }
  })

  it('should call a callback function when events that match a pattern are added', function(done) {
    let es = new EventStore();

    let filter = function(event) {
      return ( event.type === 'update-node-event');
    }

    const numberOfEvents = 1;
    let numberOfEventsReceived = 0;

    es.subscribe((eventReceived) => {
      expect(eventReceived.id).not.toBeUndefined();
      expect(eventReceived.event.type).toBe('update-node-event');
      done();
    }, filter);

    es.push({
      eventId: 'id-2',
      type: 'add-profile'
    });
    es.push({
      eventId: 'id-23890',
      type: 'update-node-event'
    });
    es.push({
      eventId: 'id-s',
      type: 'add-profile'
    });
  })

  it('TODO: should replay events from a starting index and send future events', function(done) {

    let es = new EventStore();

    let lastEventId;
    // First add a few events
    es.push({ eventId: 'pre-event-1', type: 'pre-event', testname: 'replay1' });
    es.push({ eventId: 'pre-event-2', type: 'pre-event', testname: 'replay1' });
    es.push({ eventId: 'pre-event-3', type: 'pre-event', testname: 'replay1' })
    .then( (result) => {
      lastEventId = result.id;

      let numberOfEventsReceived = 0;
      let startIndex = lastEventId;

      // console.log('lastEventId:', lastEventId);
      // console.log('startIndex:', startIndex);

      let filter = function(event) {
          return( event.testname === 'replay1');
      };

      // Start listening from the 2nd event
      es.subscribe((eventReceived) => {
        // console.log(eventReceived);
        numberOfEventsReceived++;
        if( numberOfEventsReceived < 2){
          expect(eventReceived.event.type).toBe('pre-event');
        }else {
          expect(eventReceived.event.type).toBe('post-event');
          if( numberOfEventsReceived == 3 ) {
            done();
          }
        }
      }, filter, startIndex)

      es.push({ eventId: 'post-event-4', type: 'post-event', testname: 'replay1' });
      es.push({ eventId: 'post-event-5', type: 'post-event', testname: 'replay1' });

    });

  });

});
