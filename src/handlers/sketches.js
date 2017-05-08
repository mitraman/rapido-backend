"use strict";

const representer = require('../representers/json.js')();
const winston = require('winston');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const pgp = require('pg-promise');
const sketches =  require('../model/sketches.js');
const projects = require('../model/projects.js');

module.exports = {

	findSketchesHandler: function(req, res, next) {
		winston.log('debug', 'findSketchesHandler called.');
    /*
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
    */
	},

	createSketchHandler: function(req, res, next) {
		winston.log('debug', 'createProjectHandler called.');
		winston.log('debug', req.body);

    function AuthorizationException(message) {
      this.message = 'does not conform to the expected format for a zip code';
      this.toString = function() {
        return this.message;
      };
    }

    // Get the project ID from the URL parameters
    let projectId = req.params.projectId;

    // Make sure that this user is authorized to create sketches for this project ID
    let userId = req.credentials.id;
		projects.find({
      userId: userId,
      id: projectId
    }).then( (result) => {
      if( result.length === 0 ) {
        winston.log('debug', 'User does not own the parent project of a sketch creation request')
        throw new AuthorizationException("User is not authorized to create a sketch for project ID " + projectId);
      }else {
        return sketches.create({
          projectId: projectId,
          userId: userId
        })
      }
    }).then( (result) => {
      res.status(201).send(representer.responseMessage({
        id: result.id,
        createdAt: result.createdat
      }));
    }).catch( (e) => {
      if( e instanceof AuthorizationException ) {
        res.status(401).send(representer.errorMessage("User is not authorized to create a sketch for project ID " + projectId));
      }else {
        winston.log('error', 'An error occurred while trying to create a sketch:', e);
        res.status(500).send(representer.errorMessage("An error occurred while trying to create the Sketch object"));
      }
    });
  }
}
