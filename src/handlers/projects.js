"use strict";

const representer = require('../representers/json.js')();
const winston = require('winston');
const RapidoError = require('../../src/errors/rapido-error.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const pgp = require('pg-promise');
const projects =  require('../model/projects.js');
const sketches = require('../model/sketches.js');
const sketchService = require('../services/sketches.js');


let transformProject = function(projectModel) {
	return {
		id: projectModel.id,
		name: projectModel.name,
		description: projectModel.description,
		createdAt: projectModel.createdat,
		style: projectModel.style,
		vocabulary: projectModel.vocabulary,
		sketches: []
	}
}

module.exports = {

	findProjectHandler: function(req, res, next) {
		winston.log('debug', 'findProjectHandler called.');

		let userId = req.credentials.id;
		let projectId = req.params.projectId

		winston.log('debug', 'userId:', userId);
		winston.log('debug', 'projectId:', projectId);

		//TODO: In the future, projects should have sharing flags so they can
		// be viewed and edited by non-owner users and guests.
		// Find the project (only if it is owned by this user)
		let responseBody = {
			project: {}
		};
		projects.find({
			userId: userId,
			id: projectId
		}).then( (projects) => {
			winston.log('debug', 'projects.find result:', projects);
			if( projects.length === 0 ) {
				//res.status(404).send(representer.errorMessage('Unable to locate the specified project for this user.'))
				throw new RapidoError(RapidoErrorCodes.projectNotFound, 'Unable to locate the specified project for this user.', 404);
			}else {
				let foundProject = projects[0];

				responseBody.project = transformProject(foundProject);
				// Retrieve sketches for this project
				return sketches.findByProject(projectId);

			}
		}).then( (sketches) => {
			winston.log('debug', 'sketches.findByProject result:', sketches);
			let getTreePromises = [];

			// Tree data comes from the sketch service.
			// Fire async promises for each sketch in the list and wait to collect the
			// results.
			for( let i = 0; i < sketches.length; i++ ) {
				winston.log('debug', sketches[i]);
				winston.log('debug', 'retrieving tree data for sketch ', sketches[i].id);
				let sketch = {
					id: sketches[i].id,
					createdAt: sketches[i].createdAt
				};
				responseBody.project.sketches.push(sketch);
				getTreePromises.push(sketchService.getTree(sketches[i].id));
			}

			return Promise.all(getTreePromises);
		}).then( (trees) => {
				winston.log('debug', 'result of Promise.all(getTreePromises):', trees);

				for( let i = 0; i < trees.length; i++ ) {
					responseBody.project.sketches[i].tree = trees[i];
				}

				// Send the data back to the client
				winston.log('debug', 'sending responseBody: ',responseBody);
				res.send(representer.responseMessage(responseBody));
		}).catch( (error) => {
			if( error.name === 'RapidoError' ) {
				winston.log('debug', 'Caught a RapidoError:', error);
				res.status(error.status).send(representer.errorMessage(error.message));
			} else {
				winston.log('warn', 'An error occured while retrieving a project: ', error);
				res.status(500).send('An unexpected error occurred.');
			}
		})
	},

	findProjectsHandler: function(req, res, next) {
		winston.log('debug', 'findProjectsHandler called.');

		let userId = req.credentials.id;
		projects.findByUser(userId)
		.then( (result) => {
			winston.log('debug', 'found projects: ', result);
			// Create a collection of project results
			let projectResults = [];
			for( let i = 0; i < result.length; i++ ) {
				projectResults.push(transformProject(result[i]));
			}
			res.status(200).send(representer.responseMessage({
				projects: projectResults
			}));
		}).catch( (error) => {
			winston.log('warn', 'An error occurred while trying to find projects: ', error);
      res.status(500).send(representer.errorMessage('Unable to retrieve projects'));
		})
	},

	createProjectHandler: function(req, res, next) {
		winston.log('debug', 'createProjectHandler called.');
		winston.log('debug', req.body);

    // Validate parameters
    let name = req.body.name;
    let description = req.body.description;
    let style = req.body.style;
    let userId = req.credentials.id;

    // Make sure that all mandatory properties are present.
		if( !name ) {
			winston.log('debug', 'fullname property is missing.')
			res.status(400).send(representer.errorMessage("the required property 'fullname' is missing from the request body"))
			return;
		}

		// Make sure that the style property is one of the accepted ENUM values
		if( style !== 'CRUD'  ) {
			winston.log('debug', 'Unexpected style property:', style)
			let errorMessage = "the value '" + style + "' is not allowed.  Use 'CRUD' instead. "
			res.status(400).send(representer.errorMessage(errorMessage))
			return;
		}

    // Set default values
    if( !description ) {
      description = '';
    }
    if( !style ) {
      style = 'CRUD';
    }

    let newProject = {
      name: name,
      description: description,
      style: style,
      userId: userId
    }

	  projects.create(newProject)
    .then( (result) => {
			winston.log('debug', 'New project created');
			res.status(201).send(representer.responseMessage({
				id: result.id,
				name: result.name,
				description: result.description,
				createdAt: result.createdat
			}));
    }).catch( (error) => {
			winston.log('warn', 'An error occurred while trying to create a new project: ', error);
      res.status(500).send(representer.errorMessage('Unable to create new project'));
    })
	}
}
