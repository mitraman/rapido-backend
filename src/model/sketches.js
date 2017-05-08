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
    text: "INSERT INTO sketches(projectid, userid) VALUES($1, $2) returning id, createdat",
    values: [sketch.projectId, sketch.userId]
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
          id: result[i].id,
          projectId: result[i].projectid,
          createdAt: result[i].createdat,
          modifiedAt: result[i].modifiedat,
          tree: result[i].treedata,
          orphans: result[i].orphans
        });
      }
      resolve(sketches);
    });
  });
}

module.exports = sketches;
