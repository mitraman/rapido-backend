"use strict";

const request = require("request");
const config = require('../../src/config.js');
const winston = require('winston');
const dataAccessor = require('../../src/db/DataAccessor.js');
const HandlerSupport = require('./support.js');

// TO BE IMPLEMENTED
xdescribe('/vocab API', function() {

  beforeAll( function() {
    this.vocabUrl = '';
    this.headers = {
      'Content-Type': 'application/json'
    };
  })

  describe( 'POST /vocab', function() {

    it('should add a new word to a vocabulary', function(done) {
      let newWord = 'blah'
      request.post(
        {
          url: this.vocabUrl,
          headers: this.headers,
          json: {
            words: [newWord]
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(200);
            //winston.log('debug', res.body);
            expect(body.id).toBeDefined();
            done();
        });
    })

    it('should add a new word block to a vocabulary', function(done) {
      let block = '{ "jsondata" : "here", "more" : "there"}'
      request.post(
        {
          url: this.vocabUrl,
          headers: this.headers,
          json: {
            block: block
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(200);
            //winston.log('debug', res.body);
            expect(body.id).toBeDefined();
            done();
        });
    })

  })

  describe( 'DELETE /vocab', function() {

    it('should delete a word', function(done) {

    })

    it('should delete a block', function(done) {

    })
  })


});
