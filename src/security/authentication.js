"use strict";

const winston = require('winston');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const RapidoError = require('../../src/errors/rapido-error.js')
const jwt = require('jsonwebtoken');
const representer = require('../representers/json.js')();
const config = require('../config.js');
const userModel = require('../model/users.js');


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

				console.log('make sure that this user exists');
				// Make sure that this user exists
				if( !decoded.id ) {
					console.log('no id field');
					next(new RapidoError(
						RapidoErrorCodes.authenticationProblem,
						'Bearer token is missing a required field',
						401
					));
				}else {
					console.log('looking for users...');
					userModel.find({id: decoded.id})
					.then( result => {
						console.log('result:', result);
						if( result.length < 1) {
							next(new RapidoError(
								RapidoErrorCodes.userNotFound,
								'This user no longer exists',
								401
							));
						}else {
							// store the decoded value in the request
							req.credentials = decoded;
							next();
						}
					}).catch( e => {
						next(new RapidoError(
							RapidoErrorCodes.genericError,
							'Something went wrong during authentication',
							500
						));
					})
				}
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
