"use strict";

const representer = require('../representers/json.js')();
const registrationService = require('../services/registration.js');
const winston = require('winston');
const bcrypt = require('bcrypt-nodejs');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const pgp = require('pg-promise');
const authentication = require('../security/authentication.js')
const users = require('../model/users.js');

module.exports = {

	registrationHandler: function(req, res, next) {
		winston.log('debug', 'registrationHandler called.');
		winston.log('debug', req.body);

		// Create the user object
		var fullName = req.body.fullname;
		var nickName = req.body.nickname;
		var password = req.body.password;
		var email = req.body.email;

		// Make sure that all mandatory properties are present.  The actual values are validated inside the service object
		if( !fullName ) {
			winston.log('debug', 'fullname property is missing.')
			res.status(400).send(representer.errorMessage("the 'fullname' property is missing from the request body"))
			return;
		}
		if( !nickName ) {
			winston.log('debug', 'nickname property is missing.');
			winston.log('debug', 'using fullname as the nickname property');
			nickName = fullName;
			// res.status(400).send(representer.errorMessage("the 'nickname' property is missing from the request body"))
			// return;
		}
		if( !email ) {
			winston.log('debug', 'email property is missing.')
			res.status(400).send(representer.errorMessage("the 'email' property is missing from the request body"))
			return;
		}
		if( !password ) {
			winston.log('debug', 'password property is missing.')
			res.status(400).send(representer.errorMessage("the 'password' property is missing from the request body"))
			return;
		}

		registrationService.register(email, password, fullName, nickName)
		.then((newUser)=>{
			winston.log('debug', 'Returning succesful registration response message');
			res.send(representer.responseMessage(newUser));
		})
		.catch((error)=>{
			winston.log('debug', 'Unable to register', error);
			let status = 500;
			let message = "Unable to register user";
			if( error.name === 'RapidoError' && error.code === RapidoErrorCodes.duplicateUser ) {
				status = 400;
				message = error.message;
			}else if( error.name === 'RapidoError' && error.code === RapidoErrorCodes.invalidField ) {
				status = 400;
				message = error.message;
			}
			res.type('json');
			res.status(status).send(representer.errorMessage(message));
		})


	},

	loginHandler: function(req, res, next) {

		// Extract the user details from the request
		let email = req.body.email;
		let password = req.body.password

		// Lookup the user
		users.find({email: email})
		.then( (result) => {
			if( result.length === 0) {
				res.status(401).send(representer.errorMessage('Invalid login credentials'));
			}else if( result.length === 1) {
				winston.log('debug', 'result: ', result[0]);
				// Compare the passwords
				bcrypt.compare(password, result[0].password, function(err, equivalent) {
					if( !equivalent || err ) {
						if( err ) { winston.log('warn', 'Unexpected error from bcrypt compare: ', err); }
						res.status(401).send(representer.errorMessage('Invalid login credentials'));
					}else {
						// generate and return jwt token
						let jwtToken = authentication.generateJWT({id: result[0].id, email: email});
						winston.log('debug', 'token: ', jwtToken);
						let responseBody = {
							token: jwtToken,
							email: result[0].email,
							userId: result[0].id,
							nickName: result[0].nickname,
							fullName: result[0].fullname
						}
						res.send(representer.responseMessage(responseBody));
					}
        })
			}else {
				//uh oh
				winston.log('warn', 'More than one user was returned when looking up user ', email);
				res.status(500).send(representer.errorMessage('An error occurred while trying to login'));
			}
		})
		.catch((error)=>{
			// Could not lookup the user
			winston.log('error', error);
			res.status(500).send(representer.errorMessage('An error occurred while trying to login'));
		})

	}

}
