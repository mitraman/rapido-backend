"use strict";

const representer = require('../representers/json.js')();
const winston = require('winston');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const RapidoError = require('../../src/errors/rapido-error.js');
const pgp = require('pg-promise');
const sketches =  require('../model/sketches.js');
const projects = require('../model/projects.js');

module.exports = {

	createSketchHandler: function(req, res, next) {
		winston.log('debug', 'createProjectHandler called.');
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
        id: result.id,
        createdAt: result.createdat
      }));
    }).catch( (e) => {
			console.log('in catch');
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
