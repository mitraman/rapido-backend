
const bcrypt = require('bcrypt-nodejs');
const usersDS = require('../model/users.js');
const verificationDS = require('../../src/model/user-verification.js');
const pgp = require('pg-promise');
const Promise = require('bluebird');
const winston = require('winston');
const RapidoError = require('../errors/rapido-error.js');
const RapidoErrorCodes = require('../errors/codes.js');
const validator = require('validator');
const uuidV4 = require('uuid/v4');
const nodemailer = require('nodemailer');
const config = require('../config.js')
const fs = require('fs');


// Load email templates from file system
let verificationEmailTemplatePlainText = null;
let verificationEmailTemplateHtmlText = null;

fs.readFile('./mail/verification.txt', 'utf8', function(err, data) {
	if( err ) {
		return winston.log('error', err);
		throw err;
	}
	verificationEmailTemplatePlainText = data;
});

fs.readFile('./mail/verification.html', 'utf8', function(err, data) {
	if( err ) {
		return winston.log('error', err);
	}
	verificationEmailTemplateHtmlText = data;
});

function registrationService() {};

function sendVerificationEmail(transporter, verificationToken, user) {
	if( !verificationEmailTemplatePlainText ) {
		throw new RapidoError(RapidoErrorCodes.genericError, "Verification email plain text template missing");
	}
	if( !verificationEmailTemplateHtmlText ) {
		throw new RapidoError(RapidoErrorCodes.genericError, "Verification email html template missing");
	}

	const verificationLink = "rapido.com/verify?code=" + verificationToken;
	// Replate the tokens in the email templates with the verification link
	let plainTextEmail = verificationEmailTemplatePlainText.replace(/\$\^\w+/g, verificationLink);
	//winston.log('debug', plainTextEmail);

	let htmlEmail = verificationEmailTemplateHtmlText.replace(/\$\^\w+/g, verificationLink);
	//winston.log('debug', htmlEmail)

	let mailOptions = {
	    from: 'Rapido App <rapidomailer@gmail.com>', // sender address
	    to: user.email, // list of receivers
	    subject: 'Welcome to Rapido', // Subject line
	    text: plainTextEmail, // plain text body
	    html: htmlEmail // html body
	};

	return transporter.sendMail(mailOptions)

}

registrationService.register = function(email, password, fullName, nickName, nodeMailerTransporter) {
  // Validate User inputs.
	//if(userService.validate(username, password, firstname, lastname))	return;
	winston.log('debug', 'registrationServer.register called for ' + email);

	return new Promise(function(fullfill, reject) {

		email = validator.trim(email);
		fullName = validator.trim(fullName);
		nickName = validator.trim(nickName);
		password = validator.trim(password);

		let newUser = {
			id: '',
			fullName: fullName,
			nickName: nickName,
			email: email
		};

		// Generate a verification token
		const token = uuidV4();

		if( !nodeMailerTransporter && config.nodemailer && (!config.nodemailer.testmode) ) {
			// If the nodeMailerTransport has not been specified, create one based on configuration values
			winston.log('debug', 'creating mail transport from nodemailer options', config.nodemailer.options)
			nodeMailerTransporter = nodemailer.createTransport(config.nodemailer.options);
		}

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
				winston.log('error', 'An error occurred while searching for duplicate users during registration.', error);
				reject(error);
			}
		})
		.finally( () => {

			winston.log('debug', 'Creating new user');

			// Now, try to create the user in the data store
			usersDS.create( {
				fullName: fullName,
				nickName: nickName,
				password: encryptedPassword,
				email: email
			})
			.then( (result) => {
				// Set the ID of the user object that we will be returning to the client
				newUser.id = result.id;

				// Try to insert a verirication entry into the verification table for emailing
				return verificationDS.create(newUser.id, token);
			})
			.then( (result) => {

				// ** Disabling verification email feature until it is needed in the future
				return result;

				/*
				// Only send an email if the transporter has been defined.  This is so that we can do lots of integration testing
				// without sending emails.  In the future, a better solution can be found.
				if( nodeMailerTransporter ) {
					// Send a verification email
					winston.log('debug', 'sending verification email');
					return sendVerificationEmail(nodeMailerTransporter, token, newUser);
				} else {
					return result;
				}
				*/

			})
			.then( (result) => {
				// return a result object if everything has gone well.
				winston.log('debug', 'returning succesfully from user registration');

				fullfill ({
					newUser: newUser,
					verificationToken: token
				});
			})
			.catch( (error) => {
				winston.log('warn', 'Registration Error:', error);
				reject(error);
			})
		})
});
}

registrationService.verify = function( userId, token ) {

	return new Promise(function(fullfill, reject) {
		// Find the verification token in the table and confirm it is for this user
		verificationDS.findByToken(token)
		.then((result)=>{
			winston.log('debug', 'findByToken result:', result);
			if( userId != result.userid ) {
				let errorMessage = 'The verification token ' + token + ' was not found for user ID ' + userId;
				reject(new RapidoError(RapidoErrorCodes.invalidVerificationToken, errorMessage));
			} else {
				// Update the user statusCode
				return usersDS.update({isVerified: true}, userId);
			}
		})
		.then(()=> {
			// Delete the verification token from the verification table
			return verificationDS.delete({token: token});
		}).then(()=> {
			fullfill();
		}).catch((error)=>{
			winston.log('warn', 'Verification Error:', error);
			if( error.name === 'QueryResultError' ) {
				// This means that the verification code was not found
				let errorMessage = 'The verification token ' + token + ' was not found for user ID ' + userId;
				reject(new RapidoError(RapidoErrorCodes.invalidVerificationToken, "Unable to complete verification process"));
			}

			reject(new RapidoError(RapidoErrorCodes.genericError, "Unable to complete verification process"));
		})
	});
}

module.exports = registrationService;
