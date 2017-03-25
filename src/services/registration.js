
const bcrypt = require('bcrypt-nodejs');
const usersDS = require('../model/users.js');
const pgp = require('pg-promise');
const Promise = require('bluebird');
const winston = require('winston');
const RapidoError = require('../errors/rapido-error.js');
const RapidoErrorCodes = require('../errors/codes.js');
const validator = require('validator');

function registrationService() {};

registrationService.register = function(email, password, fullName, nickName) {
  // Validate User inputs.
	//if(userService.validate(username, password, firstname, lastname))	return;
	winston.log('debug', 'registrationServer.register called for ' + email);

	return new Promise(function(fullfill, reject) {

		email = validator.trim(email);
		fullName = validator.trim(fullName);
		nickName = validator.trim(nickName);
		password = validator.trim(password);

		// Validate and normalize the fields
		if( !validator.isEmail(email)) {
			reject( new RapidoError(RapidoErrorCodes.invalidField, "email address is invalid"));
		}

		if( validator.isEmpty(fullName)) {
			reject( new RapidoError(RapidoErrorCodes.invalidField, "name cannot be blank"));
		}

		if( validator.isEmpty(nickName)) {
			reject( new RapidoError(RapidoErrorCodes.invalidField, "nick name cannot be blank"));
		}

		if( validator.isEmpty(password)) {
			reject( new RapidoError(RapidoErrorCodes.invalidField, "password cannot be blank"));
		}

		if( password.length < 4 ) {
			reject( new RapidoError(RapidoErrorCodes.invalidField, "password does not meet minimum security requirements"));
		}

		// Encrypt the password before storing. Need to have alternate encyrption in future.
		const encryptedPassword = bcrypt.hashSync(password);

		winston.log('debug', 'Checking if user already exists');
		// Check to make sure that this email address doesn't already exist in the database
		usersDS.find({email: email})
		.then( (result) => {
			winston.log('debug', 'Existing user found, returning error');
			// we shouldn't have received a result!  This means the user already exists.
			reject(new RapidoError(RapidoErrorCodes.duplicateUser, "a user with this email address already exists"));
		})
		.catch( (error) => {
			// A no data error is expected, but anything else should be thrown
			if( error.code != pgp.errors.queryResultErrorCode.noData) {
				reject(error);
			}
		})
		.finally( () => {

			winston.log('debug', 'Creating new user');

			// TODO: Generate a verification token

			// Now, try to create the user
			usersDS.create( {
				fullName: fullName,
				nickName: nickName,
				password: encryptedPassword,
				email: email
			})
			.then( (result) => {
				// return the newly created user object
				fullfill ({
					id: result.id,
					fullName: fullName,
					nickName: nickName,
					email: email
				});
			})
			.catch( (error) => {
				reject(error);
			})

		})
});
}

module.exports = registrationService;
