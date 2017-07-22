"use strict";

const request = require("request");
const config = require('../../src/config.js');
const winston = require('winston');
const dataAccessor = require('../../src/db/DataAccessor.js');
const HandlerSupport = require('./support.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');


describe('handlers/projects.js ', function() {

  const server_port = config.port;
  const urlBase = 'http://localhost:' + server_port + '/api';
  let headers = {
    'Content-Type': 'application/json'
  };

  const projectsUrl = urlBase + '/projects';
  const projectUrlTemplate = urlBase + '/projects/{projectId}';
  let projectUrl;

  // Credentials for registering and login
  const email = "project.test@email.com";
  const password = "password";
  let token = "";
  let userid;

  // Project details
  const name = "project 1";
  const description = "a project description";
  const style = "CRUD";

  // Utility function for setting up test cases
  let addProject = function(projectsToAdd, projectList, index, finished) {
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
          projectList.push(body);
          if( index >= projectsToAdd ) {
            // We are finished, call the next function
            finished(index);
          }else {
            addProject(projectsToAdd, projectList, index+1, finished);
          }
      });
  }

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

  beforeEach(function(done) {
    // Remove database data
    // Remove all of the project entries in the database for our test useer
    const db = dataAccessor.getDb();

    //console.log('deleting from sketches')
    // First delete all of this user's sketches
    db.query("DELETE FROM sketches where userid=" + userid)
    .then( ()=> {
      //console.log('deleting from projects');
      // Next delete the projects
      // db.query('SELECT * from sketches').then(function(data) {
      //   console.log(data);
      // });
    //return db.query("DELETE FROM projects WHERE userid = " +  userid)
      db.query("DELETE FROM projects WHERE userid = " +  userid).then(() => {
      })
    }).catch( (error) => {
      fail(error);
    }).finally( () => {
      done();
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
            expect(res.headers['content-type'].indexOf('application/problem+json')).toBe(0);
            expect(res.statusCode).toBe(400);
            expect(body.code).toBe(RapidoErrorCodes.fieldValidationError);
            expect(body.fields[0].field).toBe('name');
            expect(body.fields[0].type).toBe('missing');
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
            description: description,
            style: 'BAD'
          }
        },function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(400);
            expect(body.code).toBe(RapidoErrorCodes.fieldValidationError);
            expect(body.fields.length).toBe(2);
            expect(body.fields[1].field).toBe('style');
            expect(body.fields[1].type).toBe('invalid');
            done();
        }
      )
    })
  })


  describe('GET /projects', function() {

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
            //console.log(body);
            expect(body).not.toBeNull();
            let jsonBody = JSON.parse(body);
            expect(jsonBody.projects).not.toBeUndefined();
            expect(jsonBody.projects.length).toBe(projectCount);
            done();
          })
    });

    it ('should succesfully retrieve a project list for a signed in user', function(done) {
      const projectsToAdd = 6;
      let addedProjects = [];

      addProject(projectsToAdd, addedProjects, 1, function(projectCount) {
        request.get({
            url: projectsUrl,
            headers: headers
          }, function(err, res, body) {
            console.log(body);
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


    it ('should return a 404 if the specified project was not found', function(done) {
      const projectsToAdd = 1;
      let addedProjects = [];
      addProject(projectsToAdd, addedProjects, 1, function(projectCount) {

        let project = addedProjects[0];
        projectUrl =  projectUrlTemplate.replace(/{projectId}/gi, '239929');
        request.get({
            url: projectUrl,
            headers: headers
          }, function(err, res, body) {
            expect(err).toBe(null);
            expect(res.statusCode).toBe(404);
            expect(body).not.toBeNull();
            let jsonBody = JSON.parse(body);
            expect(jsonBody.code).toBe(RapidoErrorCodes.projectNotFound);
            expect(jsonBody.detail).toBe('Unable to locate the specified project for this user');
            done();
        })
      })
    })

    it( 'should return a 404 if the specified project is not owned by this user', function(done) {
      // Add a project with our test user
      let projects = [];
      addProject(1, projects, 1, function() {
        // The project was added, now register and login a second user
        HandlerSupport.registerAndLogin('ProjectOwnershipTest')
        .then( (result) => {
          const authValue = 'Bearer ' + result.token;
          let newHeaders =  {
              'Content-Type': 'application/json'
          };
          newHeaders['Authorization'] = authValue;

          // Try to retrieve the original user's project
          let projectUrl =  projectUrlTemplate.replace(/{projectId}/gi, projects[0].id);

          request.get({
            url: projectUrl,
            headers: newHeaders
          }, function(err, res, body) {
            expect(res.statusCode).toBe(404);
          });

        }).catch( (error) => {
          fail(error);
        }).finally(done);
      })
    })

    // Implement this if we need it later on.
    it ('should retrieve a specific project', function(done){
      const projectsToAdd = 4;
      let addedProjects = [];

      addProject(projectsToAdd, addedProjects, 1, function(projectCount) {

        let project = addedProjects[projectCount-1];
        projectUrl =  projectUrlTemplate.replace(/{projectId}/gi, project.id);
        request.get({
            url: projectUrl,
            headers: headers
          }, function(err, res, body) {
            winston.log('debug', 'body:', body);
            expect(err).toBe(null);
            expect(res.statusCode).toBe(200);
            expect(body).not.toBeNull();

            let jsonBody = JSON.parse(body);
            expect(jsonBody.project.name).toBe(project.name)
            expect(jsonBody.project.description).toBe(project.description);
            expect(jsonBody.project.style).toBe('CRUD');
            expect(jsonBody.project.createdAt).toBeDefined();
            expect(jsonBody.project.sketches).toBeDefined();
            expect(jsonBody.project.sketches.length).toBe(1);

            let sketch = jsonBody.project.sketches[0];
            expect(sketch.id).toBeDefined();
            expect(sketch.tree).toBeDefined();
            expect(sketch.createdAt).toBeDefined();
            expect(jsonBody.project.vocabulary).toEqual({});

            done();
        })
      })
    })

  })
})
