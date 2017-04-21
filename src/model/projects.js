const Promise = require('bluebird');
const dataAccessor = require('../db/DataAccessor.js');
const winston = require('winston');
const RapidoError = require('../errors/rapido-error.js');
const RapidoErrorCodes = require('../errors/codes.js');

const projects = function() {};

projects.create = function( project ) {

  const db = dataAccessor.getDb();
  return db.one({
    name: "create-project",
    text: "INSERT INTO projects(name, description, userid, style) VALUES($1, $2, $3, $4) returning id, name, description, style, createdat",
    values: [project.name, project.description, project.userId, project.style]
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

module.exports = projects;
