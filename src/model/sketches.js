const Promise = require('bluebird');
const dataAccessor = require('../db/DataAccessor.js');
const winston = require('winston');
const RapidoError = require('../errors/rapido-error.js');
const RapidoErrorCodes = require('../errors/codes.js');

const sketches = function() {};

sketches.create = function( sketch ) {
  const db = dataAccessor.getDb();
  return db.one({
    name: "create-sketch",
    text: "INSERT INTO sketches(name, description, projectid, userid) VALUES($1, $2, $3, $4) returning id, name, description, createdat",
    values: [sketch.name, sketch.description, sketch.projectId, sketch.userId]
  });

}

sketches.findByProject = function (projectId) {

  return new Promise( function (resolve, reject) {
    const db = dataAccessor.getDb();
    db.manyOrNone({
      name: "find-sketch-by-project",
      text: "SELECT * FROM sketches WHERE projectid=$1",
      values: [projectId]
    }).then( (result) => {
      let sketches = [];
      for( let i = 0; i < result.length; i++ ) {
        sketches.push({
          name: result[i].name,
          description: result[i].description,
          projectId: result[i].projectid,
          createdAt: result[i].createdat,
          modifiedAt: result[i].modifiedat,
          sketchData: result[i].treedata,
          vocabulary: result[i].vocabulary
        });
      }
      resolve(sketches);
    });
  });
}

module.exports = sketches;
