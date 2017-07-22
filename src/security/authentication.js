"use strict";

const winston = require('winston');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const RapidoError = require('../../src/errors/rapido-error.js')
const jwt = require('jsonwebtoken');
const representer = require('../representers/json.js')();
const config = require('../config.js');


let authentication = function() {
	this.secret = config.secret;
}

authentication.prototype.generateJWT = function(payload) {
	return jwt.sign(payload, this.secret);
}

authentication.prototype.validateJWT = function(token) {
	return jwt.verify(token, this.secret);
}

authentication.prototype.authenticateRequest = function(req, res, next) {
		winston.log('debug', 'In authentication middleware');

		//TODO: use a regex to improve the pattern matching`

		// Get a token from the auth header
		let authHeader = req.get('Authorization');
		winston.log('debug', 'Authorization Header:', authHeader);
		if( !authHeader ) {
			winston.log('debug', 'Authorization header is missing');
			//res.status(401).send(representer.errorMessage('Forbidden'));
			next(new RapidoError(
				RapidoErrorCodes.authenticationProblem,
				'HTTP Authorization header is missing',
				401
			));
		}else if( !authHeader.startsWith('Bearer') ) {
			winston.log('debug', 'Authorization header is not Bearer type');
			next(new RapidoError(
				RapidoErrorCodes.authenticationProblem,
				'HTTP Authorization must be a Bearer token',
				401
			));
		} else {
			let token = authHeader.substring(('Bearer').length);
			winston.log('debug', 'bearer token: ',token);

			// try to validate the token
			try {
				let decoded = module.exports.validateJWT(token.trim());
				// store the decoded value in the request
				req.credentials = decoded;
				next();
			}catch(e) {
				winston.log('info', 'Token validation failed:', e);
				next(new RapidoError(
					RapidoErrorCodes.authenticationProblem,
					'Authentication token validation failed',
					401
				))
			}
		}
}

module.exports = new authentication();
