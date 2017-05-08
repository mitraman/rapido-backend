const EventEmitter = require('events');
const winston = require('winston');

class SketchEventStream extends EventEmitter {
  constructor (sketchId) {
    super();
    //winston.log('debug', 'in constructor');
    this.sketchId = sketchId;
    this.state = 'wait';
    this.buffer = [];
  }

  subscribedToSketchId(sketchId) {
    //winston.log('debug', 'subscribedToSketchId for ', sketchId);
    // winston.log('debug', 'this.sketchId:', this.sketchId);
    // winston.log('debug', this.sketchId == sketchId);

    return (this.sketchId ? (this.sketchId == sketchId) : true);
  }


  emit(eventName, ...args) {
    if( this.state === 'wait' ) {
      // If the stream is busy, buffer events until it is ready
      winston.log('debug', '[SketchEventStream.emit] stream is in wait mode');
      this.buffer.push({eventName: eventName, arguments: args});
    }else {
      winston.log('debug', '[SketchEventStream.emit] stream is in ready mode, sending event');
      return super.emit(eventName, ...args);
    }
  }

  _emit(eventName, ...args) {
    return super.emit(eventName, ...args);
  }

  ready() {
    winston.log('debug', '[SketchEventStream.ready] clearing buffered events');
    // This will consume the thread, so hopefully the buffer is small!
    for( let i = 0; i < this.buffer.length; i++) {
      let event = this.buffer[i];
      winston.log('debug', '[SketchEventStream.ready] sending buffered event:', event);
      this._emit(event.eventName, ...event.arguments);
    }
    this.state = 'ready';
  }

  wait() {
    this.state = 'wait';
  }

};

module.exports = SketchEventStream;
