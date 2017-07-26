"use strict";

const representer = require('../representers/json.js')();
const winston = require('winston');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const RapidoError = require('../../src/errors/rapido-error.js');
const pgp = require('pg-promise');
const sketches =  require('../model/sketches.js');
const projects = require('../model/projects.js');
const oai2Exporter = require('../services/SwaggerExporter.js');
const sketchService = require('../services/sketches.js');
const sketchModel = require('../model/sketches.js');


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
		winston.log('debug', 'exportSketchHandler called.');
		winston.log('debug', req.body);

	  let userId = req.credentials.id;
    let projectId = req.params.projectId;
		let sketchIndex = req.params.sketchIndex;

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
					// Open API 2.0 export
					let exporter = new oai2Exporter();
					let swaggerDoc = exporter.exportTree(tree)

					// Use the accept header to determine what to send back
					if( req.accepts('yaml')) {
						res.status(200).send(swaggerDoc.yaml);
					}else {
						// Default to JSON
						res.status(200).send(swaggerDoc.json);
					}

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

	createSketchHandler: function(req, res, next) {
		winston.log('debug', 'createSketchHandler called.');
		winston.log('debug', req.body);

    // Get the project ID from the URL parameters
    let projectId = req.params.projectId;

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
			res.status(201).send(representer.responseMessage({
        index: result.sketchIndex,
        createdAt: result.createdAt
      }));
    }).catch( (e) => {
			//console.log('in catch');
			if(e.name === 'RapidoError') {
				next(e);
			}else {
				next(new RapidoError(
					RapidoErrorCodes.genericError,
					'An error occurred while trying to create the Sketch object',
					500
				))
			}
	  });
  }
}
