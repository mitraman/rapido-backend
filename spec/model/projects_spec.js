"use strict";

const projects = require('../../src/model/projects.js');
const users = require('../../src/model/users.js');
const pgp = require('pg-promise');
const winston = require('winston')
const dataAccessor = require('../../src/db/DataAccessor.js');

const newProject = {
  name: 'test project',
  description: 'a project description',
  style: 'CRUD',
  userId: 1
};

describe('create new projects', function() {

  beforeAll(function(done) {
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
      newProject.userId = result.id;
    }).catch((error)=>{
      winston.log('error', error);
      expect(error).not.toBe(null);
    }).finally(done);
  })

  it( 'should create a new project', function(done) {
    projects.create(newProject)
    .then( (result) => {
      expect(result).not.toBeUndefined();
      expect(result).not.toBeNull();
      expect(result.id).not.toBe(null);
      expect(result.name).toBe(newProject.name);
      expect(result.style).toBe(newProject.style);
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
      expect(error).not.toBe(null);
      expect(error.code).toBe('23503'); // The postgres code for foreign key constraint errors
    }).finally(done);
  });

  it ('should reject an attempt to create a project with an invalid style', function(done) {
    projects.create({
      name: newProject.name,
      description: newProject.description,
      style: 'badstyle',
      userId: newProject.userId
    })
    .then( (result) => {
      expect(result).toBeNull();
    }).catch( (error)=>{
      expect(error).not.toBe(null);
      expect(error.code).toBe('22P02'); // The postgres error code for ENUM constraint errors
    }).finally(done);
  })

  it( 'should automatically create an empty sketch when a project is created', function(done) {
    projects.create(newProject)
    .then( (result) => {
      expect(result).not.toBeNull();
      expect(result.id).not.toBe(null);
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

  const numProjects = 7;
  let addedProjects = [];
  let userId;

  beforeAll(function(done) {

    // Insert new projects into the database
    let createProject = function(index) {

      if(index >= numProjects ) {
        done();
        return;
      }
      projects.create({
        name: index,
        description: 'generated project',
        style: 'CRUD',
        userId: userId
      }).then( (result) => {
        expect(result).not.toBeNull();
        addedProjects.push(result);
        createProject(index+1);
      }).catch( (error) => {
        winston.log('error', error);
        fail(error);
      })
    }

    // Create a new user to use for projects
    users.create({
      userName: 'projectsSpec',
      fullName: 'test',
      nickName: 'user',
      password: 'blah',
      email: 'test.projectsspec@testing.com',
      verification: 'verificationtoken'
    }).then((result)=>{
      // Save the user ID of the new user
      userId = result.id;
      createProject(0);
    }).catch((error)=>{
      winston.log('error', error);
      expect(error).not.toBe(null);
    })

  });

  it('should find all of the projects that have been created for this user', function(done) {
    projects.findByUser(userId)
    .then( (result) => {
      expect(result.length).toBe(numProjects);
      result.forEach(function(project){
          expect(project.name).not.toBeUndefined();
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
      userId: userId,
      id: addedProjects[numProjects-1].id
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
        userId: userId,
        name: 'not supported for find',
        projectid: addedProjects[numProjects-1].id
      })
    } ).toThrow();
  })

});
