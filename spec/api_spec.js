"use strict";

const request = require("request");
const config = require('../src/config.js');
const winston = require('winston');

/***

Generic API tests for all routes

**/

describe('General API Tests: ', function() {

  const server_port = config.port;
  const urlBase = 'http://localhost:' + server_port + '/api';
  const headers = {
    'Content-Type': 'application/json'
  };

  const echoUrl = urlBase + '/echo';

  describe ('CORS support', function() {

    it( 'should reply with CORS headers to a preflight OPTIONS request', function(done) {
      request(
        {
          method: 'OPTIONS',
          url: echoUrl,
          headers: {
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type'
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res).not.toBe(null);
            expect(res.statusCode).toBe(204);
            expect(res.headers['access-control-allow-methods']).toBe('GET,HEAD,PUT,PATCH,POST,DELETE');
            //winston.log('debug', res.headers);
            done();
        });
    })
  })

  describe('Content Type Validator', function() {

    it( 'should reject a non JSON content type', function(done) {
      request.post(
        {
          url: echoUrl,
          headers: {
            'Content-Type': 'application/xml'
          },
          body: '<test>testing</test>'
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(415);
            winston.log('debug', res.body);
            done();
        });
    });

    it( 'should reject a malformed JSON body', function(done) {
      request.post(
        {
          url: echoUrl,
          headers: headers,
          body: '<test>testing</test>'
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(400);
            winston.log('debug', res.body);
            done();
        });
    });

    it( 'should reject an empty POST body', function(done) {

      request.post({
        url: echoUrl,
        headers: headers
      }, function(err, res, body) {
        expect(err).toBe(null);
        expect(res.statusCode).toBe(400);
        winston.log('debug', res.body);
        done();
      }
      )
    });

    it( 'should allow an empty GET body', function(done) {
      request.get({
        url: echoUrl
      }, function(err, res, body) {
        expect(err).toBe(null);
        expect(res.statusCode).toBe(200);
        done();
      }
      )
    })

    it( 'should reject a GET that accepts something other than application/json', function(done) {
      request.get({
        url: echoUrl,
        headers : {
          'Accept': 'text/plain'
        }
      }, function(err, res, body) {
        expect(err).toBe(null);
        expect(res.statusCode).toBe(406);
        done();
      }
      )
    })

  });
});
