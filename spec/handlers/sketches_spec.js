"use strict";

const request = require("request");
const config = require('../../src/config.js');
const winston = require('winston');
const dataAccessor = require('../../src/db/DataAccessor.js');
const HandlerSupport = require('./support.js');

describe('Sketchtes API', function() {

  const server_port = config.port;
  const urlBase = 'http://localhost:' + server_port + '/api';
  let headers = {
    'Content-Type': 'application/json'
  };

  const projectsUrl = urlBase + '/projects';
  let sketchesUrlTemplate = urlBase + '/projects/{projectsId}/sketches';
  let sketchesUrl;

  let token = "";
  let userid;

  // Project details
  const name = "project 1";
  const description = "a project description";
  const style = "CRUD";

  beforeAll(function(done) {
    HandlerSupport.registerAndLogin('ProjectsTest')
    .then( (result) => {
      const authValue = 'Bearer ' + result.token;
      headers['Authorization'] = authValue;
      userid = result.userId;

      // Create a project
      request.post(
        {
          url: projectsUrl,
          headers: headers,
          json: {
            name: "Test Project",
            description: "description",
            style: "CRUD"
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(201);

            sketchesUrl = sketchesUrlTemplate.replace(/{projectsId}/gi, body.id);
            console.log(sketchesUrl);
            done();
        }
      )
    }).catch( (error) => {
      fail(error);
    })
  });

  describe('POST /sketches', function() {

    it ('should reject a request without a token', function(done) {

      request.post(
        {
          url: sketchesUrl,
          headers: {
            'Content-Type': 'application/json'
          },
          json: {
            name: name
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(401);
            done();
        }
      )
    })

    it( 'should reject a request with an invalid JWT', function(done) {

      request.post(
        {
          url: sketchesUrl,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIXVCJ9...TJVA95OrM7E20RMHrHDcEfxjoYZgeFONFh7HgQ'
          },
          json: {
            name: name
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(401);
            done();
        }
      )
    });

    it( 'should reject an attempt to create a sketch for a project that is not owned by the user', function(done) {

      let invalidSketchesUrl = sketchesUrlTemplate.replace(/{projectsId}/gi, 3200);
      request.post({
          url: invalidSketchesUrl,
          headers: headers
      },function(err, res, body) {
          expect(res.statusCode).toBe(401);
          done();
      });

    })

    it( 'should create a new sketch', function(done) {
      request.post(
        {
          url: sketchesUrl,
          headers: headers,
          json: {
            name: name
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(201);
            expect(body.name).toBe(name);
            expect(body.description).toBe('');
            expect(body.createdAt).not.toBeUndefined();
            done();
        }
      )
    })

    it( 'should create a new sketch with no name', function(done) {
      request.post(
        {
          url: sketchesUrl,
          headers: headers
        },function(err, res, rawBody) {
          // Request probably doesn't parse the body if we don't send a JSON on the request
          let body = JSON.parse(rawBody);
            expect(err).toBe(null);
            expect(res.statusCode).toBe(201);
            expect(body.name).toBe('');
            expect(body.createdAt).not.toBeUndefined();
            done();
        }
      )
    })
  })
})
