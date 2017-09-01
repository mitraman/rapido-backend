"use strict";

const representer = require('../representers/json.js')();
const winston = require('winston');
const RapidoError = require('../../src/errors/rapido-error.js')
const RapidoErrorCodes = require('../../src/errors/codes.js');
const sketchService = require('../services/sketches.js');
const uuidV4 = require('uuid/v4');
const Promise = require('bluebird');
const dataAccessor = require('../db/DataAccessor.js');
const sketchModel = require('../model/sketches.js');
const CRUDService = require('../services/CRUD.js');


module.exports = {
	createNodeHandler: function(req, res, next) {
		winston.log('debug', '[createRootNodeHandler] handling request');
		let transactionID = uuidV4();

    let newNode = CRUDService.createNode();

    let userId = req.credentials.id;
		let sketchIndex = req.params.sketchIndex;
		let projectId = req.params.projectId;
		let parentId = req.params.nodeId;

		sketchModel.findBySketchIndex(projectId, sketchIndex, userId)
		.then( sketchId => {
			return sketchService.addTreeNode(userId, sketchId, newNode, parentId, transactionID);
		}).then( result => {
				winston.log('debug', '[createRootNodeHandler] result of addTreeNode:', result);
				let responseBody =
				{
					node: result.tree.hash[result.nodeId],
					rootNode: result.tree.rootNode
				}
				winston.log('debug', '[createRootNodeHandler] returning succesful response');
				res.status(201).send(representer.responseMessage(responseBody));
		}).catch( error =>  {
			if( error.name === 'RapidoError' ) {
				error.title = 'Node Creation Error';
				return next(error);
			}else {
				winston.log('warn', '[createRootNodeHandler] an error occured while trying to create a root node: ', error);
				return next(new RapidoError(RapidoErrorCodes.genericError, 'An error occurred while creating the node', 500, null, 'Node Creation Error'));
			}
		})

  },

  updateNodePropertiesHandler: function(req, res, next) {
		winston.log('debug', '[updateNodePropertiesHandler] handling request');

		let userId = req.credentials.id;
		let projectId = req.params.projectId;
		let sketchIndex = req.params.sketchIndex;
		let nodeId = req.params.nodeId;
		winston.log('debug', '[updateNodePropertiesHandler] nodeId: ', nodeId);
		let responseFieldsUpdate = { nodeId: nodeId, fields: {}};
		let updateFields = false;

		let updatePromises = [];

		sketchModel.findBySketchIndex(projectId, sketchIndex, userId)
		.then( sketchId => {

			let keys = Object.keys(req.body);

			keys.forEach( key => {
				if( key === 'data' ) {
						winston.log('debug', '[updateNodePropertiesHandler] populating a data update event')

						// The data property should have one or more method objects.

						let methodNames = Object.keys(req.body.data);

						// Only process method objects that we know about.
						methodNames.forEach( methodName => {

							const validMethodNames = ['get', 'put', 'post', 'delete', 'patch'];
							if( validMethodNames.indexOf(methodName) < 0 ) {
								// The method name that was provided is not recognized
								winston.log('debug', '[updateNodePropertiesHandler] unrecognized method ' + methodName);
								let description = "The method key " + methodName + " is not recognized."
								let error = new RapidoError(
									RapidoErrorCodes.fieldValidationError,
									"Invalid Value",
									400,
									[{
										field: 'method',
										type: 'invalid',
										description: description
									}],
									"Update Node Error"
								);
								next(error);
							}


							// Convert the method data into an update object
							let updateObject = {};
							updateObject.key = methodName;
							updateObject.fields = {};

							let dataKeys = Object.keys(req.body.data[methodName]);

							dataKeys.forEach( dataKey => {
								let data = req.body.data[methodName];

								if( data.hasOwnProperty('enabled') ) { updateObject.fields.enabled = data.enabled };
								if( data.request ) {
									updateObject.fields.request = {};
									// Parse the request data object
									let requestKeys = Object.keys(data.request);
									requestKeys.forEach( requestKey => {
										if( requestKey === 'contentType' ) { updateObject.fields.request.contentType = data.request[requestKey] };
										if( requestKey === 'queryParams' ) { updateObject.fields.request.queryParams = data.request[requestKey] };
										if( requestKey === 'body' ) { updateObject.fields.request.body = data.request[requestKey] };
									})

								}
								if( data.response ) {
									// Parse the response data object
									updateObject.fields.response = {};
									let responseKeys = Object.keys(data.response);
									responseKeys.forEach( responseKey => {
										if( responseKey === 'contentType' ) { updateObject.fields.response.contentType = data.response[responseKey] };
										if( responseKey === 'status' ) { updateObject.fields.response.status = data.response[responseKey] };
										if( responseKey === 'body' ) { updateObject.fields.response.body = data.response[responseKey] };
									})
								}
							})

						updatePromises.push(sketchService.updateBodyData(userId, sketchId, nodeId, updateObject));
						});
				}else if( key === 'name' ) {
						winston.log('debug', '[updateNodePropertiesHandler] populating a field update event for the name field');
						responseFieldsUpdate.fields.name = req.body[key];
						updateFields = true;
				}else if( key === 'fullpath' ) {
						winston.log('debug', '[updateNodePropertiesHandler] populating a field update event for the fullPath field');
						responseFieldsUpdate.fields.fullpath = req.body[key];
						updateFields = true;
				}
			})

			if( updateFields ) {
				updatePromises.push(sketchService.updateNodeDetails(userId, sketchId, nodeId, responseFieldsUpdate));
			}

			if(updatePromises.length === 0) {
				winston.log('debug', '[updateNodePropertiesHandler] nothing to update');
				let error = new RapidoError(
					RapidoErrorCodes.fieldValidationError,
					'The server did not recognize any of the fields to be updated',
					400,
					null,
					'Update Node Error',
					'Use at least one of: "name", "fullpath", "request.contentType", "request.queryParams", "reuest.body", "response.contentType", "response.status", "response.body"'
				);
				return next(error);
			}

			Promise.all(updatePromises).then(results => {
				return sketchService.getTree(sketchId)
			}).then( result => {
				winston.log('debug', '[updateNodePropertiesHandler] returning response message');
				res.status(200).send(representer.responseMessage({ node: result.tree.hash[nodeId], rootNode: result.tree.rootNode}));
				// res.status(200).send(representer.responseMessage({
				// 	tree: result.tree.treeNodes
				// }))
			}).catch( e => {
				winston.log('debug', '[updateNodePropertiesHandler] error:', e);
				if(e.name === 'RapidoError') {
					e.title = "Update Node Error";
					next(e);
				}else {
					winston.log('error', 'An unexpected error occurred while trying to update node data:', e);
					let error = new RapidoError(
						RapidoErrorCodes.genericError,
						'An unexpected error has occurred',
						500,
						null,
						'Update Node Error'
					);
					next(error);
				}
			})

		}).catch( e => {
			next(e);
		});
  },

	deleteNodeHandler: function(req, res, next) {
		winston.log('debug', '[deleteNodeHandler] handling request');

		let projectId = req.params.projectId;
		let userId = req.credentials.id;
		let sketchIndex = req.params.sketchIndex;
		let nodeId = req.params.nodeId;

		// Delete the node by creating a new event
		winston.log('debug', '[deleteNodeHandler] nodeId:', nodeId);

		sketchModel.findBySketchIndex(projectId, sketchIndex, userId)
		.then( sketchId => {
			return sketchService.removeNode(userId, sketchId, nodeId);
		}).then( result => {
			winston.log('debug', '[deleteNodeHandler] result of removeNode: ', result);
			res.status(204).send();
	  }).catch( e => {
			winston.log('debug', '[deleteNodeHandler] error:', e);
			if(e.name === 'RapidoError') {
				e.title = 'Delete Node Error';
				next(e);
			}else {
				winston.log('error', 'An unexpected error occurred while trying to delete a node:', e);
				let error = new RapidoError (
					RapidoErrorCodes.genericError,
					"An unexpected error occurred",
					500,
					null,
					"Delete Node Error");
				next(error);
			}
		});
	},

	moveNodeHandler: function(req, res, next) {
		winston.log('debug', '[moveNodeHandler] handling request');

		let projectId = req.params.projectId;
		let userId = req.credentials.id;
		let sketchIndex = req.params.sketchIndex;
		let nodeId = req.params.nodeId;

		winston.log('debug', '[moveNodeHandler] nodeId: ', nodeId);

		let target = req.body.target;
		if( !target) {
			let error = new RapidoError(
				RapidoErrorCodes.fieldValidationError,
				"A required field is missing from the request body message",
				400,
				[{
					field: 'target',
					type: 'missing',
					description: 'Missing required field "target"'
				}],
				"Move Node Error"
				);
			return next(error);
		}


		sketchModel.findBySketchIndex(projectId, sketchIndex, userId)
		.then( sketchId => {
			return sketchService.moveNode(userId, sketchId, nodeId, target);
		}).then( result => {
			winston.log('debug', '[moveNodeHandler] result of moveNode: ', result);
			res.status(200).send(representer.responseMessage({ rootNode: result.tree.rootNode}));
	  }).catch( e => {
			winston.log('debug', '[moveNodeHandler] error:', e);
			if(e.name === 'RapidoError') {
				e.title = 'Move Node Error';
				next(e);
			}else {
				winston.log('error', 'An unexpected error occurred while trying to update node data:', e);
				let error = new RapidoError (
					RapidoErrorCodes.genericError,
					"An unexpected error occurred",
					500,
					null,
					"Move Node Error");
				next(error);
			}
		});
	}


}
