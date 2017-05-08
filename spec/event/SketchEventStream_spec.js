"use strict";

const winston = require('winston');
const Promise = require('bluebird');
const SketchEventStream = require('../../src/event/SketchEventStream.js');


describe('SketchEventStream', function() {
  it('should create an event stream and store a sketchID in the constructor', function() {
    let emitter = new SketchEventStream(10);
  })

  it('should not emit events while the stream is in a busy state', function() {
    let emitter = new SketchEventStream();

    let eventHandlerSpy = jasmine.createSpy("eventHandlerSpy");

    emitter.on('test-event', eventHandlerSpy);

    emitter.emit('test-event');
    expect(eventHandlerSpy).not.toHaveBeenCalled();

  })

  it('should release buffered events when the state changes', function(done) {
    let emitter = new SketchEventStream();

    let eventHandler = function(event) {
      expect(event).toBeDefined();
      done();
    }

    emitter.on('test-event', eventHandler);

    emitter.emit('test-event', 'test');
    emitter.ready();
  })

  it('should clear the buffer in the order that events were originally received', function(done) {
    let emitter = new SketchEventStream();

    let index = 1;
    let eventCount = 5;

    let eventHandler = function(event) {
      expect(event).toBeDefined();
      expect(event).toEqual(index);
      index++;
      if( index > eventCount ) {
        done();
      }
      //done();
    }

    emitter.on('test-event', eventHandler);

    // load the buffer with an event.
    emitter.emit('test-event', 2);
    emitter.emit('test-event', 3);
    emitter.emit('test-event', 4);
    emitter.emit('test-event', 5);

    emitter._emit('test-event', 1);
    emitter.ready();
  })

})
