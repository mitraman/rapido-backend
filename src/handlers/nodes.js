"use strict";

const representer = require('../representers/json.js')();
const winston = require('winston');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const sketchService = require('../services/sketches.js');
const uuidV4 = require('uuid/v4');
const Promise = require('bluebird');

module.exports = {

	//TODO: createRootNdoe and createChildNode should use the same code
	createRootNodeHandler: function(req, res, next) {
		winston.log('debug', '[createRootNodeHandler] handling request');
		let transactionID = uuidV4();

    let newNode = {
        name: '',
        fullpath: '',
        data: {}
    }
    let userId = req.credentials.id;
		let sketchId = req.params.sketchId
		let nodeId;

    sketchService.addTreeNode(sketchId, newNode, null, transactionID)
    .then( result => {
			winston.log('debug', '[createRootNodeHandler] result of addTreeNode:', result);
			let responseBody =
			{
				node: result.tree.hash[result.nodeId],
				tree: result.tree.rootNodes
			}
			winston.log('debug', '[createRootNodeHandler] returning succesful response');
			res.status(201).send(representer.responseMessage(responseBody));
		}).catch( e =>  {
			winston.log('warn', '[createRootNodeHandler] an error occured while trying to create a root node: ', e);
			//TODO send back correct error (4xx or 5xx)
		})

  },

  createChildNodeHandler: function(req, res, next) {
		winston.log('debug', '[createChildNodeHandler] handling request');
    let newNode = {
        name: '',
        fullpath: '',
        data: {}
    }
		let userId = req.credentials.id;
		let sketchId = req.params.sketchId;
    let parentId = req.params.nodeId;

		winston.log('debug', '[createChildNodeHandler] sketchId: ' + sketchId);
		winston.log('debug', '[createChildNodeHandler] parentId: ' + parentId);

    sketchService.addTreeNode(sketchId, newNode, parentId)
    .then( result => {
				winston.log('debug', '[createChildNodeHandler] result of addTreeNode: ', result);
        res.status(201).send(representer.responseMessage({
					node: result.tree.hash[result.nodeId],
					tree: result.tree.rootNodes
				}));
    }).catch( error => {
      winston.log('warn', 'an error occurred while trying to create a child node: ', error);
			if( error.name === 'RapidoError' ) {
				res.status(error.status).send(representer.errorMessage(error.message));
			}else {
				res.status(500).send(representer.errorMessage("Unexpected Server Error"));
			}
    })
  },

  updateNodePropertiesHandler: function(req, res, next) {
		winston.log('debug', '[updateNodePropertiesHandler] handling request');

		let sketchId = req.params.sketchId;
		let nodeId = req.params.nodeId;
		winston.log('debug', '[updateNodePropertiesHandler] nodeId: ', nodeId);
		let responseFieldsUpdate = { nodeId: nodeId, fields: {}};
		let updateFields = false;

		let updatePromises = [];

		let keys = Object.keys(req.body);
		keys.forEach( key => {
			if( key === 'data' ) {
					winston.log('debug', '[updateNodePropertiesHandler] populating a data update event')
					// Parse the response data
					let dataKeys = Object.keys(req.body.data);
					dataKeys.forEach( dataKey => {
						let data = req.body.data[dataKey];
						winston.log('adebug', '[updateNodePropertiesHandler] req.body.data[key]:', data);
						let dataFields = {};
						if( data.contentType ) { dataFields.contentType = data.contentType };
						if( data.hasOwnProperty('enabled') ) { console.log('data.enabled'); dataFields.enabled = data.enabled };
						if( data.queryParams ) { dataFields.queryParams = data.queryParams };
						if( data.requestBody ) { dataFields.requestBody = data.requestBody };
						if( data.responseBody ) { dataFields.responseBody = data.responseBody };
						let responseDataUpdate = {
							key: dataKey,
							fields: dataFields
						}
						updatePromises.push(sketchService.updateBodyData(sketchId, nodeId, responseDataUpdate));
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
			updatePromises.push(sketchService.updateNodeDetails(sketchId, nodeId, responseFieldsUpdate));
		}

		if(updatePromises.length === 0) {
			winston.log('debug', '[updateNodePropertiesHandler] nothing to update');
			res.status(400).send(representer.errorMessage('Unable to recognize any fields to update'));
		}

		Promise.all(updatePromises).then(results => {
			return sketchService.getTree(sketchId)
		}).then( result => {
			winston.log('debug', '[updateNodePropertiesHandler] returning response message');
			res.status(200).send(representer.responseMessage({ tree: result.tree.rootNodes}));
			// res.status(200).send(representer.responseMessage({
			// 	tree: result.tree.treeNodes
			// }))
		}).catch( e => {
			winston.log('debug', '[updateNodePropertiesHandler] error:', e);
			if(e.name === 'RapidoError') {
				res.status(e.status).send(representer.errorMessage(e.message));
			}else {
				winston.log('error', 'An unexpected error occurred while trying to update node data:', e);
				res.status(500).send(representer.errorMessage("An unexpected error occurred"));
			}
		})

  }


}
