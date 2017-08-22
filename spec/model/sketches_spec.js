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

  let addSketches = function (numSketches, index, finished, results) {
    if( !results ) {
      results = [];
    }

    if( index >= numSketches ) {
      finished(results);
      return;
    }

    sketches.create({
      userId: newSketch.userId,
      projectId: newSketch.projectId
    }).then( (result) => {
      results.push(result);
      addSketches(numSketches, index+1, finished, results);
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
      let userId = result.id;
      newSketch.userId = result.id;

      // Insert a new project row into the projects table
      const db = dataAccessor.getDb();

      return db.one({
        name: "insert-project",
        text: "INSERT INTO projects(name, userid, style)\
         VALUES($1, $2, $3) returning id",
        values: ['sketchServiceTest', userId, 'CRUD']
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
    .catch(e => {
      fail(e);
    }).finally(done);
  })

  it( 'should create a new sketch', function(done) {
    const db = dataAccessor.getDb();

    sketches.create(newSketch)
    .then( (result) => {
      expect(result.sketchIndex).toBe(1);
      return db.query('SELECT * from sketches where id=' + result.id);
    }).then( result => {
      expect(result.length).toBe(1);
      expect(result[0].id).toBeDefined();
      expect(result[0].sketchindex).toBe(1);
      return;
    }).catch( (error) => {
      fail(error);
    }).finally(done);

  });

  it('should increment the sketch index for a project when multiple sketches are added', function(done) {
    const db = dataAccessor.getDb();

    sketches.create(newSketch)
    .then( (result) => {
      expect(result.sketchIndex).toBe(1);
      return sketches.create(newSketch);
    }).then( result => {
      expect(result.sketchIndex).toBe(2);

      // Insert a second project into the table
      return db.one({
        name: "insert-project",
        text: "INSERT INTO projects(name, userid, style)\
         VALUES($1, $2, $3) returning id",
        values: ['sketchServiceTest', newSketch.userId, 'CRUD']
      });
    }).then( result => {
      // Create a sketch for the new project
      let secondProjectSketch = {
        userId: newSketch.userId,
        projectId: result.id
      };
      return sketches.create(secondProjectSketch);
    }).then( result => {
      expect( result.sketchIndex).toBe(1);
      // Create a sketch for the original project
      return sketches.create(newSketch);
    }).then( result => {
      expect( result.sketchIndex).toBe(3);
    }).catch( (error) => {
      fail(error);
    }).finally(done);

  })

  it('should throw an error if a sketch is not found by ID', function(done) {
    addSketches(5, 0, (results) => {
      let sketchId = 'bad-sketch'

      sketches.findById(sketchId)
      .then( (result)=> {
        fail('should have thrown an error');
      }).catch( (error) => {
        expect(error).toBeDefined();
      }).finally(done);
    })
  })

  it( 'should find a sketch by ID', function(done) {
    addSketches(5, 0, (results) => {
      // Find the fourth sketch that was added
      let sketchId = results[3].id;

      sketches.findById(sketchId)
      .then( (result)=> {
          expect(result).toBeDefined;
      }).catch( (error) => {
        fail(error);
      }).finally(done);
    })
  })


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


    // ** MAIN
    addSketches(numSketches, 0, () => {
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
