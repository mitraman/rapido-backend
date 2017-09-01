"use strict";

const representer = require('../representers/json.js')();
const winston = require('winston');
const RapidoError = require('../../src/errors/rapido-error.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const pgp = require('pg-promise');
const projects =  require('../model/projects.js');
const sketches = require('../model/sketches.js');
const sketchService = require('../services/sketches.js');
const CRUDService = require('../services/CRUD.js');


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

let transformSketch = function(sketchModel) {
	return {
		id: sketchModel.id,
		index: sketchModel.index,
		projectId: sketchModel.projectId,
		createdAt: sketchModel.createdAt,
		modifiedAt: sketchModel.modifiedAt,
		tree: sketchModel.tree,
		orphans: sketchModel.orphans
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
				let error = new RapidoError(
					RapidoErrorCodes.projectNotFound,
					'Unable to locate the specified project for this user',
					404,
					null,
					'Find Projects Error'
				);
				throw error;
			}else {
				let foundProject = projects[0];

				responseBody.project = transformProject(foundProject);

				// Retrieve sketches for this project
				return sketches.findByProject(projectId);
			}
		}).then( (sketchModels) => {
			winston.log('debug', '[handler/projects.findByProject] retrieved sketches:', sketchModels);

			let sketches = []
			sketchModels.forEach( sketchModel => {
				sketches.push(transformSketch(sketchModel));
			})

			let getTreePromises = [];

			// Tree data comes from the sketch service.
			// Fire async promises for each sketch in the list and wait to collect the
			// results.
			for( let i = 0; i < sketches.length; i++ ) {
				winston.log('debug', '[handler/projects.findByProject] retrieving tree data for sketch ', sketches[i].id);
				let sketch = {
					id: sketches[i].id,
					index: sketches[i].index,
					createdAt: sketches[i].createdAt
				};
				responseBody.project.sketches.push(sketch);
				getTreePromises.push(sketchService.getTree(sketches[i].id));
			}

			return Promise.all(getTreePromises);
		}).then( (trees) => {
				winston.log('debug', '[handler/projects.findByProject] result of Promise.all(getTreePromises):', trees);

				for( let i = 0; i < trees.length; i++ ) {
					winston.log('debug', '[handler/projects.findByProject] sketch  #' + i + ' getTree result:', trees[i]);
					responseBody.project.sketches[i].rootNode = trees[i].tree.rootNode;
				}

				// Send the data back to the client
				winston.log('debug', '[handler/projects.findByProject] sending responseBody: ',responseBody);
				res.send(representer.responseMessage(responseBody));
		}).catch( (error) => {
			if( error.name === 'RapidoError' ) {
				winston.log('debug', 'Caught a RapidoError:', error);
				next(error);
			} else {
				winston.log('warn', 'An error occured while retrieving a project: ', error);
				//res.status(500).send('An unexpected error occurred.');
				next(new RapidoError(
					RapidoErrorCodes.genericError,
					'An unexpected error occurred.',
					500,
					null,
					'Find Projects Error'));
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
			if( error.name === 'RapidoError' ) {
				next(error);
			} else {
				winson.log('warn', 'Find projects error: ', error);
				next(new RapidoError(
					RapidoErrorCodes.genericError,
					'An unexpected error occurred.',
					500,
					null,
					'Find Projects Error'));
			}
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
		let fieldErrors = [];
		if( !name ) {
			fieldErrors.push({
				field: 'name',
				type: 'missing',
				description: 'missing the required property: "name"'
			})
			winston.log('debug', 'project name property is missing.')
		}

		// Make sure that the style property is one of the accepted ENUM values
		if( style !== 'CRUD'  ) {
			winston.log('debug', 'Unexpected style property:', style)
			fieldErrors.push({
				field: 'style',
				type: 'invalid',
				description: 'the style property must be: "CRUD"'
			})
		}

		if( fieldErrors.length > 0) {
			let error =  new RapidoError(
				RapidoErrorCodes.fieldValidationError,
				'There were problems with the parameters provided for this create project request',
				400,
				fieldErrors,
				'Create Project Error'
			);
			next(error);
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

		let createdProject = {
		}

	  projects.create(newProject)
    .then( (result) => {

			winston.log('debug', 'New project created');

			createdProject.id = result.newProject.id;
			createdProject.name = result.newProject.name;
			createdProject.description = result.newProject.description;
			createdProject.createdAt = result.newProject.createdat;
			createdProject.sketches = [{
				id: result.newSketch.id,
				index: 1,
				createdAt: result.newSketch.createdAt
			}];

			//TODO: Move this into a service

			// Add a default root node to the sketch
			let rootNode = CRUDService.createRootNode()
			return sketchService.createRootNode(userId, result.newSketch.id, rootNode);
		}).then( result => {
			console.log('*** result:', result);
			createdProject.sketches[0].rootNode = result.tree.rootNode;
			res.status(201).send(representer.responseMessage({
				project: createdProject
			}));
    }).catch( (error) => {
			winston.log('warn', 'An error occurred while trying to create a new project: ', error);
			next(new RapidoError(
				RapidoErrorCodes.genericError,
				'Unable to create new project',
				500
			));
    })
	}
}
