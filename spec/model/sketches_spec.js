"use strict";

const sketches = require('../../src/model/sketches.js');
const projects = require('../../src/model/projects.js');
const users = require('../../src/model/users.js');
const pgp = require('pg-promise');
const winston = require('winston')
const dataAccessor = require('../../src/db/DataAccessor.js');

const newSketch = {
  userId: -1,
  projectId: -1
};

describe('sketch model', function() {

  beforeAll(function(done) {
    // Create a user to use for operations
    users.create({
      userName: 'sketchesSpec',
      fullName: 'test',
      nickName: 'user',
      password: 'blah',
      email: 'test.projectsspec@testing.com',
      verification: 'verificationtoken'
    }).then((result)=>{
      // Save the user ID of the new user
      newSketch.userId = result.id;

      // Create a new project for the sketches
      return projects.create({
        name: 'project for sketches',
        description: 'a project description',
        style: 'CRUD',
        userId: newSketch.userId
      });
    }).then( (result) => {
      expect(result).not.toBeUndefined();
      newSketch.projectId = result.id;
    }).catch((error)=>{
      winston.log('error', error);
      expect(error).not.toBe(null);
    }).finally(done);
  })

  beforeEach(function(done) {
    // Delete sketches before each run
    const db = dataAccessor.getDb();
    db.query('DELETE FROM sketches where projectid=' + newSketch.projectId)
    .then( (result) => {
      done();
    })
  })

  it( 'should create a new sketch', function(done) {
    sketches.create(newSketch)
    .then( (result) => {
      expect(result).not.toBeUndefined();
      expect(result.id).not.toBeUndefined();
    }).catch( (error) => {
      fail(error);
    }).finally(done);
  });

  it(' should return an empty list of sketches', function(done) {
    sketches.findByProject(newSketch.projectId)
    .then( (result)=> {
        expect(result).not.toBeUndefined;
        expect(result.length).toBe(0);
    }).catch( (error) => {
      fail(error);
    }).finally(done);
  });

  it( 'should find a list of sketches for a project', function (done) {

    // Add a few sketches
    const numSketches = 8;

    let addSketches = function (index, finished) {
      if( index >= numSketches ) {
        finished();
        return;
      }
      sketches.create({
        userId: newSketch.userId,
        projectId: newSketch.projectId
      }).then( (result) => {
        addSketches(index+1, finished);
      }).catch( (error) => {
        fail(error);
      })
    }

    //Recursive iterator to validate sketches.
    let validateSketches = function( sketches, done, index ) {
      if( !index ) {
        index = 0;
      }else if( index === (sketches.length) ) {
        done();
        return;
      }
      let sketch = sketches[index];

      expect(sketch.projectId).toBe(newSketch.projectId);

      validateSketches(sketches, done, index+1);
    }

    // ** MAIN
    addSketches(0, () => {
      sketches.findByProject(newSketch.projectId)
      .then( (result)=> {
          expect(result).not.toBeUndefined;
          expect(result.length).toBe(numSketches);
          validateSketches(result, done);
      }).catch( (error) => {
        fail(error);
      })
    })

  })

/*
  it( 'should reject a sketch that is missing a project id' ,function(done) {
    sketches.create({
      name: newSketch.name,
      description: newSketch.description,
      userId: newSketch.userId
    }).then( (result) => {
      fail("should have thrown an error.")
    }).catch( (error) => {
      expect(error).not.toBeNull();
    }).finally(done);
  })

  it( 'should reject a sketch that is missing a user id' ,function(done) {
    sketches.create({
      name: newSketch.name,
      description: newSketch.description,
      projectId: newSketch.projectId
    }).then( (result) => {
      fail("should have thrown an error.")
    }).catch( (error) => {
      expect(error).not.toBeNull();
    }).finally(done);
  })
*/

});
