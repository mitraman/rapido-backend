"use strict";

const passport = require('passport');
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
			res.status(status).send(representer.errorMessage(message));
		})


	},

	loginHandler: function(req, res, next) {

		// Extract the user details from the request
		let email = req.body.email;
		let clearTextPassword = req.body.password

		// bcrypt the password for comparison
		let password = bcrypt.hashSync(clearTextPassword);

		// Lookup the user
		users.find({email: email, password: password })
		.then( (result) => {
			// generate a jwt token
			let jwtToken = authentication.generateJWT(email);
			res.send(representer.responseMessage({token: jwtToken}));
		})
		.catch((error)=>{
			// Could not lookup the user
			if( error.name === 'QueryResultError' && error.code === pgp.errors.queryResultErrorCode.noData ) {
				res.status(401).send(representer.errorMessage('Invalid login credentials'));
			} else {
				res.status(500).send(representer.errorMessage('An error occurred while trying to login'));
			}

		})

	}

}
