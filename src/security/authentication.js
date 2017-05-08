"use strict";

const passport = require('passport');
const winston = require('winston');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const jwt = require('jsonwebtoken');
const representer = require('../representers/json.js')();

console.log('************************ GET SECRET FROM ENVIRONMENT!!!!! *****');
//TODO: get the secret from the environment
const secret = 'secret';

module.exports = {

	generateJWT: function(payload) {
		return jwt.sign(payload, secret);
  },

	validateJWT: function(token) {
		return jwt.verify(token, secret);
	},

	authenticateRequest(req, res, next) {
		winston.log('debug', 'In authentication middleware');

		//TODO: use a regex to improve the pattern matching`

		// Get a token from the auth header
		let authHeader = req.get('Authorization');
		winston.log('debug', 'Authorization Header:', authHeader);
		if( !authHeader ) {
			winston.log('debug', 'Authorization header is missing');
			res.status(401).send(representer.errorMessage('Forbidden'));
		}else if( !authHeader.startsWith('Bearer') ) {
			winston.log('debug', 'Authorization header is not Bearer type');
			res.status(401).send(representer.errorMessage('Forbidden'));
		} else {
			let token = authHeader.substring(('Bearer').length);
			winston.log('debug', 'bearer token: ',token);

			// try to validate the token
			try {
				let decoded = module.exports.validateJWT(token.trim());
				// store the decoded value in the request
				req.credentials = decoded;
			}catch(e) {
				winston.log('info', 'Token validation failed:', e);
				res.status(401).send(representer.errorMessage('Forbidden'));
				return;
			}
			next();
		}
	}


}
