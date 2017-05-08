"use strict";

const winston = require('winston');
const Promise = require('bluebird');
const SketchEventStream = require('../../src/event/SketchEventStream.js');
const TreeEventSubscription = require('../../src/event/TreeEventSubscription.js');
const EventStore = require('../../src/event/EventStore.js');
const treeEventProcessor = require('../../src/event/TreeEventProcessor.js');

describe('TreeEventSubscription', function() {
  let es = new EventStore();
  let sketchId = 10;
  let fakeTreeEventProcessor;

  beforeEach(function() {
    spyOn(treeEventProcessor, "applyTreeEvent").and.callFake(function(event, tree) {
      return new Promise( (resolve,reject) => {
        resolve();
      } )
    })
  })

  it('should emit an \'event_processed\' event when a SketchEvent is completely processed ', function(done) {
    let eventHandler = new TreeEventSubscription(sketchId, treeEventProcessor);
    let testEvent = { id: 3, name: 'test', type: 'testing'}

    let processStream = eventHandler.stream();
    processStream.on('event_processed', function(processEvent) {
        expect(processEvent).toEqual(testEvent);
        done();
    })

    eventHandler.onEvent(testEvent);

  })

  it('should record the lastEventID handled', function(done) {
    let eventHandler = new TreeEventSubscription(sketchId, treeEventProcessor);
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
    let eventHandler = new TreeEventSubscription(sketchId, treeEventProcessor);

    eventHandler.onEvent({id: 1, type: 'test_type'});
    expect(treeEventProcessor.applyTreeEvent).toHaveBeenCalledTimes(1);

  })

  it('should store the state of a tree after applying a treenode_added event', function(done) {
    let eventHandler = new TreeEventSubscription(sketchId, treeEventProcessor);
    let nodeId = 'a1';

    // Let the real processor handle the event
    treeEventProcessor.applyTreeEvent.and.callThrough();

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
    let subscriber = new TreeEventSubscription(sketchId, treeEventProcessor);
    let eventStore = new EventStore();

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

    eventStore.subscribe(sketchId, subscriber.onEvent, 0 );
    eventStore.push(sketchId, 'treenode_added', newEvent);
  })

  it('should return the sketchId for this subscription', function() {
    let subscriber = new TreeEventSubscription(sketchId, treeEventProcessor);
    expect(subscriber.getSketchID()).toBe(sketchId);
  })

})
