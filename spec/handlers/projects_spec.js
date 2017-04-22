"use strict";

const request = require("request");
const config = require('../../src/config.js');
const winston = require('winston');
const dataAccessor = require('../../src/db/DataAccessor.js');
const HandlerSupport = require('./support.js');

describe('Projects API', function() {

  const server_port = config.port;
  const urlBase = 'http://localhost:' + server_port + '/api';
  let headers = {
    'Content-Type': 'application/json'
  };

  const projectsUrl = urlBase + '/projects';

  // Credentials for registering and login
  const email = "project.test@email.com";
  const password = "password";
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
      done();
    }).catch( (error) => {
      fail(error);
    })
  })

  describe('POST /projects', function() {

    it ('should reject a request without a token', function(done) {

      request.post(
        {
          url: projectsUrl,
          headers: {
            'Content-Type': 'application/json'
          },
          json: {
            name: name,
            description: description,
            style: style
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
          url: projectsUrl,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIXVCJ9...TJVA95OrM7E20RMHrHDcEfxjoYZgeFONFh7HgQ'
          },
          json: {
            name: name,
            description: description,
            style: style
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(401);
            done();
        }
      )
    });

    it( 'should create a new project', function(done) {
      request.post(
        {
          url: projectsUrl,
          headers: headers,
          json: {
            name: name,
            description: description,
            style: style
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(201);
            expect(body.name).toBe(name);
            expect(body.description).toBe(description);
            expect(body.id).not.toBeUndefined();
            expect(body.createdAt).not.toBeUndefined();
            done();
        }
      )
    })

    it ('should reject a new project with a missing name', function(done) {
      request.post(
        {
          url: projectsUrl,
          headers: headers,
          json: {
            description: description,
            style: style
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(400);
            expect(body.error).toBe('the required property \'fullname\' is missing from the request body');
            done();
        }
      )
    })

    it( 'should reject a new project with a bad style', function(done) {
      request.post(
        {
          url: projectsUrl,
          headers: headers,
          json: {
            name: name,
            description: description,
            style: 'BAD'
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(400);
            done();
        }
      )
    })
  })

  describe('GET /projects', function() {



    beforeEach(function() {
      // Remove all of the project entries in the database for our test useer

      const db = dataAccessor.getDb();
      //console.log(userid);
      db.query("DELETE FROM projects WHERE userid = " +  userid);

    })

    it( 'should reject an attempt to retrieve projects without a signed in user', function(done) {
      request.get(
        {
          url: projectsUrl,
          headers: {
            'Content-Type': 'application/json'
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(401);
            done();
        }
      )
    })

    it ('should succesfully retrieve an empty project list for a signed in user', function(done) {
        let projectCount = 0;
        request.get({
            url: projectsUrl,
            headers: headers
          }, function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(200);
            expect(body).not.toBeNull();
            let jsonBody = JSON.parse(body);
            expect(jsonBody.projects).not.toBeUndefined();
            expect(jsonBody.projects.length).toBe(projectCount);
            done();
          })
    });

    it ('should succesfully retrieve a project list for a signed in user', function(done) {
      const projectsToAdd = 6;

      let addProject = function(index, finished) {
        request.post(
          {
            url: projectsUrl,
            headers: headers,
            json: {
              name: name + index ,
              description: description,
              style: style
            }
          },function(err, res, body) {
              expect(res.statusCode).toBe(201);
              if( index >= projectsToAdd ) {
                // We are finished, call the next function
                finished(index);
              }else {
                addProject(index+1, finished);
              }
          });
      }

      addProject(1, function(projectCount) {
        request.get({
            url: projectsUrl,
            headers: headers
          }, function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(200);
            expect(body).not.toBeNull();
            let jsonBody = JSON.parse(body);
            expect(jsonBody.projects).not.toBeUndefined();
            expect(jsonBody.projects.length).toBe(projectCount);
            jsonBody.projects.forEach(function(project) {
              expect(project.name).not.toBeUndefined();
            })
            done();
        })
      })

    });
  });

  describe ('GET /projects/{id}', function() {
    it ('should retrieve a specific project', function(){
      fail('to be implemented');
    })
  })
})
