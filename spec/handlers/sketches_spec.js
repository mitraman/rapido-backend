"use strict";

const request = require("request");
const config = require('../../src/config.js');
const winston = require('winston');
const dataAccessor = require('../../src/db/DataAccessor.js');
const HandlerSupport = require('./support.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');

describe('Sketches API', function() {

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
            done();
        }
      )
    }).catch( (error) => {
      fail(error);
    })
  });

  beforeEach(function(done) {
    // Delete sketch data
    const db = dataAccessor.getDb();
    db.query('DELETE FROM sketches')
    .catch(e => {
      fail(e);
    }).finally(done);
  })

  describe('POST /sketches', function() {

    it( 'should reject an attempt to create a sketch for a project that is not owned by the user', function(done) {

      let invalidSketchesUrl = sketchesUrlTemplate.replace(/{projectsId}/gi, 3200);
      request.post({
          url: invalidSketchesUrl,
          headers: headers
      },function(err, res, body) {
        let jsonBody = JSON.parse(body);
        expect(res.statusCode).toBe(401);
        expect(jsonBody.code).toBe(RapidoErrorCodes.authorizationError);
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
          expect(body.index).toBe(1);
          expect(body.createdAt).toBeDefined();
          done();
        }
      )
    })

    it( 'should generate a serial id for sketches', function(done) {
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
            expect(body.index).toBe(1);
            expect(body.createdAt).not.toBeUndefined();
            request.post(
              {
                url: sketchesUrl,
                headers: headers,
                json: {
                  name: name
                }
              },function( err, res, body) {
              expect(err).toBe(null);
              expect(res.statusCode).toBe(201);
              expect(body.index).toBe(2);
              expect(body.createdAt).not.toBeUndefined();
              done();
            })
        }
      )
    })
  })
})
