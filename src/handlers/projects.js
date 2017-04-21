"use strict";

const representer = require('../representers/json.js')();
const winston = require('winston');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const pgp = require('pg-promise');
const projects =  require('../model/projects.js');

module.exports = {

	findProjectsHandler: function(req, res, next) {
		winston.log('debug', 'findProjectsHandler called.');

		let userId = req.credentials.id;
		projects.findByUser(userId)
		.then( (result) => {
			winston.log('debug', 'found projects: ', result);
			// Create a collection of project results
			let projectResults = [];
			for( let i = 0; i < result.length; i++ ) {
				projectResults.push({
					id: result[i].id,
					name: result[i].name,
					description: result[i].description,
					style: result[i].style,
					createdAt: result[i].createdat
				})
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
			console.log(error);
      winston.log('warn', 'An error occurred while trying to create a new project: ', error);
      res.status(500).send(representer.errorMessage('Unable to create new project'));
    })
	}
}
