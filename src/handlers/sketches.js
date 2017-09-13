"use strict";

const representer = require('../representers/json.js')();
const winston = require('winston');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const RapidoError = require('../../src/errors/rapido-error.js');
const pgp = require('pg-promise');
const sketches =  require('../model/sketches.js');
const projects = require('../model/projects.js');
const OA2Exporter = require('../services/OA2Exporter.js');
const OA3Exporter = require('../services/OA3Exporter.js');
const sketchService = require('../services/sketches.js');
const sketchModel = require('../model/sketches.js');
const CRUDService = require('../services/CRUD.js');


//TODO: Move this into middleware
//TODO: Needs to be rewritten to handle the case of sketchId without projectId
// let authorizeSketchBySketchID = function(userId, projectId) {
//
// 	return new Promise( (resolve, reject) => {
// 		// Make sure that this user is authorized to create sketches for this project ID
// 		projects.find({
// 			userId: userId,
// 			id: projectId
// 		}).then( (result) => {
// 			if( result.length === 0 ) {
// 				winston.log('debug', 'User does not own the parent project of a sketch creation request');
// 				reject( new RapidoError(
// 					RapidoErrorCodes.authorizationError,
// 					'User is not authorized to make changes to the project with an ID of ' + projectId,
// 					401
// 				));
// 			}else {
// 				resolve(true);
// 			}
// 		});
// 	});
// }
//


module.exports = {

	exportSketchHandler: function(req, res, next) {
		winston.log('debug', '[sketches.js] exportSketchHandler called.');
		//winston.log('debug', req.body);

	  let userId = req.credentials.id;
    let projectId = req.params.projectId;
		let sketchIndex = req.params.sketchIndex;

		let title = 'Rapido Export';
		let description = '';

		// Validate that this sketch is owned by the user
		sketchModel.findBySketchIndex(projectId, sketchIndex, userId)
		.then( sketchId => {
			return sketchService.getTree(sketchId);
		}).then( result => {
				let tree = result.tree;
				let exportFormat = req.query.format;
				if(!exportFormat) {
					next(
						new RapidoError(RapidoErrorCodes.fieldValidationError,
							'There were problems with the parameters provided for this export request',
							400,
							[
								{
									field: 'format',
									type: 'missing',
									description: 'the request is missing a mandatory "format" query paramater'
								}
							],
							'Export Sketch Error')
					);
				}else if(exportFormat === 'oai2') {
					winston.log('debug', '[sketches.js] performing OAI2 export');
					// Open API 2.0 export
					// TODO: get the project title and description for the export
					let swaggerDoc = OA2Exporter.exportTree(tree, title, description);
					res.status(200).send(swaggerDoc);
				}else if( exportFormat === 'oai3') {
					winston.log('debug', '[sketches.js] performing OAI3 export');
					// TODO: get the project title and description for the export
					let doc = OA3Exporter.exportTree(tree, title, description);
					res.status(200).send(doc);
				}else {
					// reject unknown formats
					//TODO: send the correct error
					next(
						new RapidoError(RapidoErrorCodes.fieldValidationError,
							'There were problems with the parameters provided for this export request',
							400,
							[
								{
									field: 'format',
									type: 'invalid',
									description: 'the format specified is not recognized'
								}
							],
							'Export Sketch Error')
					);
				}
		}).catch( e => {
			next(e);
		})
	},

	retrieveSketchHandler: function(req, res, next) {
		winston.log('debug', 'retrieveSketchHandler called.');
		winston.log('debug', req.body);


		let sketchId = req.params.sketchId;
		winston.log('debug', 'retrieving sketch by ID:', sketchId);

		let sketch = {};

		sketches.findById(sketchId)
		.then( result => {
			let userId = req.credentials.id;
			sketch.id = result.id;

			// Make sure that the user is authorized to access this sketch
			// For now, only the user who owns the project can look at a sketch
			return projects.find({id: result.projectId})
		}).then( result => {
			let userId = req.credentials.id;
			if( result[0].userid != userId ) {
				throw new RapidoError(
					RapidoErrorCodes.sketchNotFound,
					'Unable to find sketch or user is not authorized to access sketch',
					404
				);
			}

			return sketchService.getTree(sketch.id);
		}).then( result => {
			sketch.rootNode = result.tree.rootNode;
			res.status(200).send(representer.responseMessage({
				sketch: sketch
			}));
		}).catch( e => {
			if(e.name === 'RapidoError') {
				if( e.code === RapidoErrorCodes.sketchNotFound ) {
					e.message = 'Unable to find sketch or user is not authorized to access sketch';
				}
				next(e);
			}else {
				next(new RapidoError(
					RapidoErrorCodes.genericError,
					'An error occurred while trying to create the Sketch object',
					500
				))
			}
		})



	},

	//TODO: Automatically create a rootnode
	createSketchHandler: function(req, res, next) {
		winston.log('debug', 'createSketchHandler called.');
		winston.log('debug', req.body);

    // Get the project ID from the URL parameters
    let projectId = req.params.projectId;

		let sketch = {};

		// Make sure that this user is authorized to create sketches for this project ID
    let userId = req.credentials.id;
		projects.find({
      userId: userId,
      id: projectId
    }).then( (result) => {
			if( result.length === 0 ) {
        winston.log('debug', 'User does not own the parent project of a sketch creation request');
				throw new RapidoError(
					RapidoErrorCodes.authorizationError,
					'User is not authorized to create a sketch for project ID ' + projectId,
					401
				);
        //throw new AuthorizationException("User is not authorized to create a sketch for project ID " + projectId);
      }else {
        return sketches.create({
          projectId: projectId,
          userId: userId
        })
      }
    }).then( (result) => {
			sketch = {
				id: result.id,
				index: result.sketchIndex,
				createdAt: result.createdAt
			};

			// Add a default root node to the sketch
			let rootNode = CRUDService.createRootNode()
			return sketchService.createRootNode(userId, sketch.id, rootNode);
		}).then( result => {
			// Get the new node tree so we can add it to the result
			return sketchService.getTree(sketch.id);
		}).then( result => {
			sketch.rootNode = result.tree.rootNode;

			res.status(201).send(representer.responseMessage({
				sketch: sketch
      }));
    }).catch( (e) => {
			//console.log('in catch');
			if(e.name === 'RapidoError') {
				next(e);
			}else {
				winston.log('error', '[Sketches Handler] error:', e);
				next(new RapidoError(
					RapidoErrorCodes.genericError,
					'An error occurred while trying to create the Sketch object',
					500
				))
			}
	  });
  }
}
