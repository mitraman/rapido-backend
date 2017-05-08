const Promise = require('bluebird');
const dataAccessor = require('../db/DataAccessor.js');
const sketches = require('./sketches');
const winston = require('winston');
const RapidoError = require('../errors/rapido-error.js');
const RapidoErrorCodes = require('../errors/codes.js');

const projects = function() {};

projects.create = function( project ) {

  const db = dataAccessor.getDb();

  let createProjectResult;

  return new Promise( function(resolve, reject)  {
    db.one({
      name: "create-project",
      text: "INSERT INTO projects(name, description, userid, style, vocabulary)\
       VALUES($1, $2, $3, $4, $5) returning id, name, description, style, createdat, vocabulary",
      values: [project.name, project.description, project.userId, project.style, '{}']
    }).then( (result) => {
      // Store the result so we can return it later
      createProjectResult = result;

      // Create a default sketch for this project
      return sketches.create({projectId: result.id, userId: project.userId})
    }).then( (result) => {
      // Everything went well, so return the original create project result
      resolve(createProjectResult);
    }).catch( (error) => {
      reject(error);
    })
  });

}

projects.findByUser = function (userId) {
  const db = dataAccessor.getDb();
  return db.manyOrNone({
    name: "find-project-by-user",
    text: "SELECT * FROM projects WHERE userid=$1",
    values: [userId]
  });
}

projects.find = function( params ) {
  const db = dataAccessor.getDb();

  let queryString = "SELECT * FROM projects WHERE";
  let queryParams = [];
  let queryName = "find-projects-by";

  function queryBuilder(paramName, valueName) {
    if( !valueName ) {
      valueName = paramName
    }
    if( queryParams.length > 0 ) { queryString += " AND"; }
    queryParams.push(params[paramName]);
    queryString += " " + valueName + "=$" + queryParams.length;
    queryName += "-"+valueName;
  }

  let numberParamsRecognized = 0;

  if( params ) {
      if( params.id ) {
        queryBuilder("id");
        numberParamsRecognized++;
      }
      if( params.userId ) {
        queryBuilder("userId");
        numberParamsRecognized++;
      }
  }

  if( numberParamsRecognized < Object.keys(params).length ) {
    throw new RapidoError(RapidoErrorCodes.invalidField, "Unrecognized parameters provided for find projects operation");
  }

  if( queryParams.length === 0 ) {
    throw new RapidoError(RapidoErrorCodes.invalidField, "No parameters provided for find projects operation")
    //winston.log('debug', 'This is the error**************************')
  }

  return db.manyOrNone({
    name: queryName,
    text: queryString,
    values: queryParams
  });

}

module.exports = projects;
