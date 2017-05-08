"use strict";

const passport = require('passport');
const winston = require('winston');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const jwt = require('jsonwebtoken');
const representer = require('../representers/json.js')();


module.exports = {

	authorizeRequest(req, res, next) {
		winston.log('debug', 'In authorization middleware');

		// validate parameters
		if( req.param.projectId ) {
			winston.log('debug', 'User is not authorized to access project');
			res.status(401).send(representer.errorMessage('Forbidden'));
		}
		if( req.param.sketchId ) {
			winston.log('debug', 'User is not authorized to access sketch');
			res.status(401).send(representer.errorMessage('Forbidden'));
		}
		next();
		}
	}


}
