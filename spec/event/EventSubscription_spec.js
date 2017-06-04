"use strict";

const winston = require('winston');
const Promise = require('bluebird');
const SketchEventStream = require('../../src/event/SketchEventStream.js');
const EventSubscription = require('../../src/event/EventSubscription.js');
const EventStore = require('../../src/event/EventStore.js');
const eventProcessor = require('../../src/event/EventProcessor.js');
const dataAccessor = require('../../src/db/DataAccessor.js');

describe('EventSubscription', function() {

  beforeAll(function() {
      this.es = new EventStore();
      this.sketchId = 10;
  });

  beforeEach(function(done) {
    spyOn(eventProcessor, "applyEvent").and.callFake(function(event, graph) {
      return new Promise( (resolve,reject) => {
        resolve();
      } )
    })

    // Clear all event data from the database
    dataAccessor.getDb().query('delete from sketchevents').finally(done);
  })

  afterEach(function() {
    this.es.unsubscribeAll(this.sketchId);
  })

  it('should emit an \'event_processed\' event when a SketchEvent is completely processed ', function(done) {
    let eventHandler = new EventSubscription(this.sketchId, eventProcessor);
    let testEvent = { id: 3, name: 'test', type: 'testing'}

    let processStream = eventHandler.stream();
    processStream.on('event_processed', function(processEvent) {
        expect(processEvent).toEqual(testEvent);
        done();
    })

    eventHandler.onEvent(testEvent);

  })

  it('should record the lastEventID handled', function(done) {
    let eventHandler = new EventSubscription(this.sketchId, eventProcessor);
    let eventCount = 0;

    // Get a stream to be alerted when events are applied to the cache
    let processStream = eventHandler.stream();
    processStream.on('event_processed', function(processEvent) {
        if( eventCount === 0 ) {
          expect(eventHandler.lastEventIDProcessed).toBe(11);
        }else {
          expect(eventHandler.lastEventIDProcessed).toBe(22);
          done()
        }
        eventCount++;
    })

    eventHandler.onEvent({type: '', id: 11});
    eventHandler.onEvent({id: 22});

  })

  it('should apply an event using a TreeEventProcessor', function() {
    let eventHandler = new EventSubscription(this.sketchId, eventProcessor);

    eventHandler.onEvent({id: 1, type: 'test_type'});
    expect(eventProcessor.applyEvent).toHaveBeenCalledTimes(1);

  })

  it('should store the state of a tree after applying a treenode_added event', function(done) {
    let eventHandler = new EventSubscription(this.sketchId, eventProcessor);
    let nodeId = 'a1';

    // Let the real processor handle the event
    eventProcessor.applyEvent.and.callThrough();

    let processStream = eventHandler.stream();
    processStream.on('event_processed', function(processEvent) {
      expect(processEvent.id).toBe(1);
      expect(eventHandler.tree.hash[nodeId]).toBeDefined();
      expect(eventHandler.tree.rootNodes.length).toBe(1);
      expect(eventHandler.tree.rootNodes[0].name).toBe('tree_state_test');
      done();
    })

    eventHandler.onEvent({id: 1, data: { node: {id: nodeId, name: 'tree_state_test', fullpath: '/testing'} },  type: 'treenode_added'});
  })

  it('should process events emitted by the EventStore module', function(done) {
    let subscriber = new EventSubscription(this.sketchId, eventProcessor);

    let processStream = subscriber.stream();
    processStream.on('event_processed', function(processEvent) {
      expect(processEvent.data).toEqual(newEvent);
      done();
    })

    let newEvent = {
      node: {
        id: 1,
        name: 'testing',
        fullpath: '/testing'
      }
    }

    const userId = 1;
    this.es.subscribe(this.sketchId, subscriber.onEvent, 0 );
    this.es.push(userId, this.sketchId, 'treenode_added', newEvent);
  })

  it('should return the this.sketchId for this subscription', function() {
    let subscriber = new EventSubscription(this.sketchId, eventProcessor);
    expect(subscriber.getSketchID()).toBe(this.sketchId);
  })

})
