"use strict";

const request = require("request");
const config = require('../src/config.js');
const winston = require('winston');

/***

Generic API tests for all routes

**/

describe('General API', function() {

  const server_port = config.port;
  const urlBase = 'http://localhost:' + server_port + '/api';
  const headers = {
    'Content-Type': 'application/json'
  };

  describe ('CORS support', function() {
    const registrationUrl = urlBase + '/register';

    it( 'should reply with CORS headers to a preflight OPTIONS request', function(done) {
      request(
        {
          method: 'OPTIONS',
          url: registrationUrl,
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

  describe('POST /register', function() {
    const registrationUrl = urlBase + '/register';

    it( 'should reject a non JSON content type', function(done) {
      request.post(
        {
          url: registrationUrl,
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
          url: registrationUrl,
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
        url: registrationUrl,
        headers: headers
      }, function(err, res, body) {
        expect(err).toBe(null);
        expect(res.statusCode).toBe(400);
        winston.log('debug', res.body);
        done();
      }
      )
    });

  });
});
