const Promise = require('bluebird');
const dataAccessor = require('../db/DataAccessor.js');
const winston = require('winston');
const RapidoError = require('../errors/rapido-error.js');
const RapidoErrorCodes = require('../errors/codes.js');

const sketches = function() {};

sketches.create = function( sketch ) {
  const db = dataAccessor.getDb();

  return new Promise( (resolve, reject) => {

    // Insert a new sketch and generate a new incremental sketchindex
    db.one({
      name: "create-sketch",
      text: "INSERT INTO sketches (userid, projectid, sketchindex)"
       + " VALUES ($1, $2, ( select coalesce( (max(sketchindex) + 1), '1') from sketches where projectid=$2 )) RETURNING id, sketchindex, createdat;",
      values: [sketch.userId, sketch.projectId]
    }).then( result => {
      resolve({
        id: result.id,
        sketchIndex: result.sketchindex,
        createdAt : result.createdat
      });
    }).catch(e => {
      reject(e);
    })
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
          index: result[i].sketchindex,
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

// Utility function to retrieve a sketch ID based on the primary key
sketches.findBySketchIndex = function(projectId, sketchIndex, userId) {
	const db = dataAccessor.getDb();

	return new Promise( (resolve, reject) => {
		db.one({
			name: "get-sketchid",
			text: "SELECT id FROM sketches where sketchindex = $1 and projectid = $2 and userid = $3",
			values: [sketchIndex, projectId, userId]
		}).then( result => {
			resolve(result.id);
		}).catch( e => {
			reject(new RapidoError(RapidoErrorCodes.sketchNotFound, 'This sketch index does not exist for this project', 404, null, 'Sketch Node Error'));
		})
	});
}


module.exports = sketches;
