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
  let projectId;

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
            projectId = body.project.id;
            sketchesUrl = sketchesUrlTemplate.replace(/{projectsId}/gi, body.project.id);
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

  describe('GET /sketches/:id', function() {

    let getSketchId;

    beforeEach(done => {
      // Create a test sketch
      const db = dataAccessor.getDb();
      db.query('INSERT into sketches (userid, projectid, sketchindex) VALUES ($1, $2, $3) RETURNING id',
      [userid, projectId, 1])
      .then(result => {
        console.log('result:', result);
        getSketchId = result[0].id;
      }).catch(e => {
        console.log('ERROR:', e);
      }).finally(done);
    });

    it('should retrieve a sketch by ID', function(done) {
      let sketchId = getSketchId;
      let sketchUrl = urlBase + '/sketch/' + sketchId;
      request.get({
          url: sketchUrl,
          headers: headers
      },function(err, res, body) {
        let jsonBody = JSON.parse(body);
        expect(res.statusCode).toBe(200);
        expect(jsonBody.sketch).toBeDefined();
        expect(jsonBody.sketch.id).toBeDefined();
        expect(jsonBody.sketch.id).toBe(sketchId);
        expect(jsonBody.sketch.rootNode).toBeDefined();
        done();
      });

    })

    it('should return a 404 if a sketch is not found', function(done) {
      let sketchUrl = urlBase + '/sketch/' + 'bad-id';
      request.get({
          url: sketchUrl,
          headers: headers
      },function(err, res, body) {
        let jsonBody = JSON.parse(body);
        expect(res.statusCode).toBe(404);
        done();
      });
    });

    it('should return a 404 if a sketch is not visible to this user', function(done) {
      let sketchId = getSketchId;
      let sketchUrl = urlBase + '/sketch/' + sketchId;

      HandlerSupport.registerAndLogin('ProjectsTest-baduser-getsketch')
      .then( (result) => {
        const authValue = 'Bearer ' + result.token;
        let invalidHeaders = {'Authorization':  authValue};
        //newUserid = result.userId;

        request.get({
            url: sketchUrl,
            headers: invalidHeaders
        },function(err, res, body) {
          let jsonBody = JSON.parse(body);
          expect(res.statusCode).toBe(404);
          done();
        });
      });
    });

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
          expect(body.sketch).toBeDefined();
          expect(body.sketch.id).toBeDefined();
          expect(body.sketch.index).toBe(1);
          expect(body.sketch.createdAt).toBeDefined();
          expect(body.sketch.rootNode).toBeDefined();
          expect(body.sketch.rootNode.children.length).toBe(0);
          done();
        }
      )
    })

    it( 'should generate a new index and unique root node', function(done) {
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
            expect(body.sketch.index).toBe(1);
            let firstSketch = body.sketch;
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
              expect(body.sketch.index).toBe(2);
              expect(body.sketch.rootNode.id).not.toEqual(firstSketch.rootNode.id);
              done();
            })
        }
      )
    })
  })
})
