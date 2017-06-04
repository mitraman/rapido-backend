"use strict";

const winston = require('winston');
const Promise = require('bluebird');
const eventProcessor = require('../../src/event/EventProcessor.js');

describe('EventProcessor', function() {
  it('should reject an attempt to apply an unknown event', function(done) {
    let event = {
      type: 'unknown_type'
    }
    eventProcessor.applyEvent(event)
    .then( () => {
      fail('the event processor should have rejected this attempt')
    }).catch( e => {
      expect(e).toBeDefined();
      console.log(e);
      expect(e.startsWith('unable to handle an unknown event type')).toBe(true);
      done();
    })
  })
})
