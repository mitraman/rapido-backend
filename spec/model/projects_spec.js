"use strict";

const projects = require('../../src/model/projects.js');
const users = require('../../src/model/users.js');
const pgp = require('pg-promise');
const winston = require('winston')
const dataAccessor = require('../../src/db/DataAccessor.js');
const RapidoError = require('../../src/errors/rapido-error.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const Promise = require('bluebird');


describe('projects model', function() {

  // Recursive function to create test projects and add them to a list
  let createProjects = function(index, numProjectsToCreate, projectList, userId, callback) {
    if(index >= numProjectsToCreate ) {
      callback();
      return;
    }
    projects.create({
      name: index,
      description: 'generated project',
      style: 'CRUD',
      userId: userId
    }).then( (result) => {
      expect(result).not.toBeNull();
      projectList.push(result);
      createProjects(index+1, numProjectsToCreate, projectList, userId, callback);
    }).catch( (error) => {
      winston.log('error', error);
      fail(error);
    })
  }


  beforeAll(function(done) {
    this.newProject = {
      name: 'test project',
      description: 'a project description',
      style: 'CRUD',
      userId: 1
    };

    // Create a user to use for operations
    users.create({
      userName: 'projectsSpec',
      fullName: 'test',
      nickName: 'user',
      password: 'blah',
      email: 'test.projectsspec@testing.com',
      verification: 'verificationtoken'
    }).then((result)=>{
      // Save the user ID of the new user
      this.newProject.userId = result.id;
      this.userId = result.id;
    }).catch((error)=>{
      winston.log('error', error);
      expect(error).toBeDefined();
    }).finally(done);

  })


  describe('create new projects', function() {

    it( 'should create a new project', function(done) {
      projects.create(this.newProject)
      .then( (result) => {
        expect(result).toBeDefined();
        expect(result).not.toBeNull();
        expect(result.id).not.toBe(null);
        expect(result.name).toBe(this.newProject.name);
        expect(result.style).toBe(this.newProject.style);
        expect(result.vocabulary).toEqual({});
      }).catch( (error)=>{
        winston.log('error', error);
        expect(error).toBe(null);
      }).finally(done);
    })

    it(' should reject an attempt to create a project with a user ID that does not exist', function(done) {
      projects.create({
        name: 'test project',
        description: 'a project description',
        style: 'CRUD',
        userId: 30000
      })
      .then( (result) => {
        expect(result).toBeNull();
      }).catch( (error)=>{
        expect(error).toBeDefined();
        expect(error.code).toBe('23503'); // The postgres code for foreign key constraint errors
      }).finally(done);
    });

    it('should reject an attempt to create a project with an invalid style', function(done) {
      projects.create({
        name: this.newProject.name,
        description: this.newProject.description,
        style: 'badstyle',
        userId: this.newProject.userId
      })
      .then( (result) => {
        expect(result).toBeNull();
      }).catch( (error)=>{
        expect(error).toBeDefined();
        expect(error.code).toBe('22P02'); // The postgres error code for ENUM constraint errors
      }).finally(done);
    })

    it( 'should automatically create an empty sketch when a project is created', function(done) {
      projects.create(this.newProject)
      .then( (result) => {
        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        const db = dataAccessor.getDb();
        return db.any("select * from sketches where projectid=$1",[result.id])
      }).then( (result) => {
        expect(result.length).toBe(1);
      }).catch( (error)=>{
        winston.log('error', error);
        fail(error);
      }).finally(done);
    })
  })

  describe('find projects', function() {

    beforeAll(function(done) {

      // Remove all of the sketch and  project data from previous tests
      let db = dataAccessor.getDb();
      db.any('delete from sketches where userid = $1', [this.userId])
      .then( result => {
        return db.any('delete from projects where userid = $1 ',  [this.userId])
      }).then( () => {
        // Add test data
        this.numProjects = 7;
        this.addedProjects = [];
        createProjects(0, this.numProjects, this.addedProjects, this.userId, done);
      }).catch( e=> {
        fail(e);
      });

    });

    it('should find all of the projects that have been created for this user', function(done) {
      projects.findByUser(this.userId)
      .then( (result) => {
        expect(result.length).toBe(this.numProjects);
        result.forEach(function(project){
            expect(project.name).toBeDefined();
        })
      }).catch( (error) => {
        expect(error).toBeNull();
        winston.log('error', error);
      }).finally(done);
    });

    it('should find 0 projects for a user that does not exist', function(done) {
      projects.findByUser(2383)
      .then( (result) => {
        expect(result.length).toBe(0);
      }).catch( (error) => {
        expect(error).toBeNull();
        winston.log('error', error);
      }).finally(done);
    });

    it('should find a specified project for a specified user', function(done) {
      projects.find({
        userId: this.userId,
        id: this.addedProjects[this.numProjects-1].id
      }).then( (result) => {
        expect(result).not.toBeNull();
        expect(result.length).toBe(1);
      }).catch( (error) => {
        fail(error);
      }).finally(done);
    })

    it('should reject an attempt to find with an unknown paramter', function() {
      expect( ()=>{
        projects.find({
          userId: this.userId,
          name: 'not supported for find',
          projectid: this.addedProjects[this.numProjects-1].id
        })
      } ).toThrow();
    })

})

describe('update a project', function() {

  beforeEach(function(done) {
    // Remove all of the sketch and  project data from previous tests
    let db = dataAccessor.getDb();
    db.any('delete from sketches where userid = $1', [this.userId])
    .then( result => {
      return db.any('delete from projects where userid = $1 ',  [this.userId])
    }).then( () => {
      // Add test data
      this.numProjects = 1;
      this.addedProjects = [];
      createProjects(0, this.numProjects, this.addedProjects, this.userId, done);
    }).catch( e=> {
      fail(e);
    });
  })

  it('should reject a project update without any parameters', function() {
    expect( ()=>{
      projects.update(this.addedProjects[0].id, {})
    } ).toThrow();
  })

  it('should reject a project update with an unknown parameter', function() {
    expect( ()=>{
      projects.update(this.addedProjects[0].id, {
        name: 'newName',
        description: 'new description',
        badProperty: 'blah'
      })
    } ).toThrow();
  })

  it('should update a project name', function(done) {
    let newName = 'a new project name';
    projects.update(this.addedProjects[0].id, {
      name: newName
    }).then( () => {
      // Check the data to make sure the project was updated
      let db = dataAccessor.getDb();
      db.one('select * from projects where id=$1', [this.addedProjects[0].id])
      .then( project => {
        expect(project.name).toBe(newName);
        expect(project.description).toBe(this.addedProjects[0].description);
        done();
      })
    }).catch( e => {
      fail(e);
      done();
    })
  })

  it('should update a project description', function(done) {
    let newDescription = 'a new project description';
    projects.update(this.addedProjects[0].id, {
      description: newDescription
    }).then( () => {
      // Check the data to make sure the project was updated
      let db = dataAccessor.getDb();
      db.one('select * from projects where id=$1', [this.addedProjects[0].id])
      .then( project => {
        expect(project.name).toBe(this.addedProjects[0].name);
        expect(project.description).toBe(newDescription);
        done();
      })
    }).catch( e => {
      fail(e);
      done();
    })
  })

  it('should update a project name and description', function(done) {
    let newName = 'a new project name';
    let newDescription = 'a new project description';
    projects.update(this.addedProjects[0].id, {
      name: newName,
      description: newDescription
    }).then( () => {
      // Check the data to make sure the project was updated
      let db = dataAccessor.getDb();
      db.one('select * from projects where id=$1', [this.addedProjects[0].id])
      .then( project => {
        expect(project.name).toBe(newName);
        expect(project.description).toBe(newDescription);
        done();
      })
    }).catch( e => {
      fail(e);
      done();
    })
  })

})


});
