
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
const config = require('../config.js')
const fs = require('fs');
const EmailService = require('../services/Email.js')


let verificationEmailTemplatePlainText, verificationEmailTemplateHtmlTextl;
let initialized = false;

let RegistrationService = function () {
  winston.log('debug', 'in Registration Service constructor');

  winston.log('debug', '[RegistrationService] Reading mail/verification.txt');
	fs.readFile('./mail/verification.txt', 'utf8', function(err, data) {
    winston.log('debug', '[RegistrationService] verification.txt callback');
		if( err ) {
			return winston.log('error', err);
			throw err;
		}
		verificationEmailTemplatePlainText = data;
    vetpt = data;
    winston.log('debug', '[RegistrationService] Loaded plain text email template');
	});

  winston.log('debug', '[RegistrationService] Reading mail/verification.html');
	fs.readFile('./mail/verification.html', 'utf8', function(err, data) {
		if( err ) {
			return winston.log('error', err);
		}
		verificationEmailTemplateHtmlText = data;
    initialized = true;
    winston.log('debug', '[RegistrationService] Loaded HTML email template');
	});
};

RegistrationService.prototype.isInitialized = function() {
  return initialized;
}


RegistrationService.sendVerificationEmail = function(verificationToken, user) {
  winston.log('debug', '[RegistrationService] sendVerificationEmail called');
  winston.log('debug', '[RegistrationService] sendVerificationEmail verificationToken:', verificationToken);

  if( !verificationEmailTemplatePlainText ) {
		throw new RapidoError(RapidoErrorCodes.genericError, "Verification email plain text template missing");
	}
	if( !verificationEmailTemplateHtmlText ) {
		throw new RapidoError(RapidoErrorCodes.genericError, "Verification email html template missing");
	}

  //TODO: This should come from a config value
	let verificationLink = "https://rapidodesigner.com/verify?code=";
  if( config.nodemailer && config.nodemailer.linkBase ) {
    verificationLink = config.nodemailer.linkBase;
  }

  verificationLink = verificationLink + verificationToken;

  winston.log('debug', '[RegistrationService] sendVerificationEmail verificationLink:', verificationLink);
	// Replate the tokens in the email templates with the verification link
	let plainTextEmail = verificationEmailTemplatePlainText.replace(/\$\^\w+/g, verificationLink);
	//winston.log('debug', plainTextEmail);

	let htmlEmail = verificationEmailTemplateHtmlText.replace(/\$\^\w+/g, verificationLink);
	//winston.log('debug', htmlEmail)

  winston.log('debug', '[RegistrationService] sendVerificationEmail user email:', user.email);
  winston.log('debug', 'user:', user);

  winston.log('debug', '[RegistrationService] sending email.');

  return EmailService.sendEmail(user.email, user.fullName, 'Welcome to Rapido', htmlEmail, plainTextEmail);


}

RegistrationService.prototype.register = function(email, password, fullName, nickName) {

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
			email: email,
			isVerified: false
		};

		// Generate a verification token
		const token = uuidV4();

		let fieldErrors = [];

		// Validate and normalize the fields
		if( !validator.isEmail(email)) {
			fieldErrors.push({
				field: 'email',
				type: 'invalid',
				description: 'email address is invalid'
			});
			//reject( new RapidoError(RapidoErrorCodes.invalidField, "email address is invalid"));
		}

		if( validator.isEmpty(fullName)) {
			fieldErrors.push({
				field: 'fullname',
				type: 'invalid',
				description: 'fullname cannot be blank'
			});
			//reject( new RapidoError(RapidoErrorCodes.invalidField, "name cannot be blank"));
		}

		if( validator.isEmpty(nickName)) {
			fieldErrors.push({
				field: 'nickname',
				type: 'invalid',
				description: 'nickname cannot be blank'
			});
			//reject( new RapidoError(RapidoErrorCodes.invalidField, "nick name cannot be blank"));
		}

		if( validator.isEmpty(password)) {
			fieldErrors.push({
				field: 'password',
				type: 'invalid',
				description: 'password cannot be blank'
			});
			//reject( new RapidoError(RapidoErrorCodes.invalidField, "password cannot be blank"));
		}

		if( password.length < 4 ) {
			fieldErrors.push({
				field: 'password',
				type: 'invalid',
				description: 'password length must be greater than four characters'
			});
		}

		if( fieldErrors.length > 0 ) {
			reject( new RapidoError(
				RapidoErrorCodes.fieldValidationError,
				"registration field errors",
				400,
				fieldErrors,
				"Registration Error"
			));
			return;
		}


		// 1. Check for existing email addresses
		// 2. Hash the password
		// 3. Add a verificatin entry
		// 4. Send a verification email
		// 5. Fulfill the promise

		let hashPromise = function(password) {
			return new Promise( (resolve, reject) => {
				bcrypt.hash(password, null, null, (err, encryptedPassword) => {
					if( err ) {
						reject(err);
					}else {
					resolve(encryptedPassword);
					}
				});
			});
		}


		winston.log('debug', 'Checking if user already exists');
		usersDS.find({email: email})
		.then( (result) => {
			if( result.length > 0) {
				winston.log('debug', 'Existing user found, returning error');
				// we shouldn't have received a result!  This means the user already exists.
				throw new RapidoError(
					RapidoErrorCodes.duplicateUser,
					"a user with this email address already exists",
					400);
			}else {
				return result;
			}
		}).then( () => {
			winston.log('debug', 'hashing password');
			return hashPromise(password)
		}).then( (encryptedPassword) => {
			winston.log('debug', 'Creating new user');
			// Now, try to create the user in the data store
			return usersDS.create( {
				fullName: fullName,
				nickName: nickName,
				password: encryptedPassword,
				email: email
			})
		}).then( (result) => {
			// Set the ID of the user object that we will be returning to the client
			newUser.id = result.id;

			winston.log('debug', 'Updating verification table');
			// Try to insert a verification entry into the verification table for emailing
			return verificationDS.create(newUser.id, token);
		}).then( (result) => {
			return RegistrationService.sendVerificationEmail(token, newUser);
		}).then( () => {
			// return a newUser object if everything has gone well.
			winston.log('debug', 'returning succesfully from user registration');

			fullfill ({
				newUser: newUser,
				verificationToken: token
			});
		}).catch( (error) => {
			winston.log('warn', 'Registration Error:', error);
			reject(error);
		})
	});  // End of promise
}

RegistrationService.prototype.resendVerificationEmail = function(email) {

  return new Promise( (resolve, reject) => {
    winston.log('debug', '[RegistrationService] resendVerificationEmail called');
    let user, token;

    // Look up the user
    usersDS.find({email:email})
    .then( result => {
      winston.log('debug', '[RegistrationService] retrieved user by email:', result);
      if( result.length < 1) {
        winston.log('debug', '[RegistrationService] this user does not exist');
        // This user does not exist
        reject(new RapidoError(
          RapidoErrorCodes.userNotFound,
          "No user with this email address was found",
          400
        ));
      }
      user = result[0];
      winston.log('debug','[RegistrationService] user:', user);
      if(user.isverified) {
        winston.log('debug', '[RegistrationService] this user is already verified');
        // This user is already verified, so need to send an email
        reject(new RapidoError(
          RapidoErrorCodes.alreadyVerified,
          "This user is already verified",
          400
        ));
      }

      winston.log('debug', '[RegistrationService] retrieving the verificaiton code');
      // Get the verification code
      return verificationDS.findById(user.id);
    }).then( result => {
      // Send the email
      winston.log('debug', '[RegistrationService] result:', result);
      RegistrationService.sendVerificationEmail(result.verifytoken, user);
      resolve();
    }).catch( error => {
			if( error.name === 'QueryResultError' ) {
        winston.log('debug', 'verification entry not found');
				// This means that the verification code was not found, so create a new one and send an email
        const token = uuidV4();
        verificationDS.create(user.id, token)
        .then( result => {
          RegistrationService.sendVerificationEmail(token, user);
          resolve();
        })
      }else {
        winston.log('error', '[RegistrationService] Unable to send email: ', error);
		    reject(new RapidoError(RapidoErrorCodes.genericError, "Unable to complete verification process", 500));
      }
    })
  });
}

RegistrationService.prototype.verify = function( token ) {

	return new Promise(function(fullfill, reject) {
		// Find the verification token in the table and confirm it is for this user

		verificationDS.findByToken(token)
		.then((result)=>{
			winston.log('debug', 'findByToken result:', result);
			userId = result.userid;
			// Delete the verification token from the verification table
			return verificationDS.delete({token: token});
		}).then(()=> {
			fullfill({
				userId: userId
			});
		}).catch((error)=>{
			winston.log('warn', 'Verification Error:', error);
			if( error.name === 'QueryResultError' ) {
				// This means that the verification code was not found
				let errorMessage = 'The verification token ' + token + ' was not found.';
				reject(new RapidoError(RapidoErrorCodes.invalidVerificationToken, "Unable to complete verification process", 400));
			}
      winston.log('error', '[RegistrationService] Unable to verify a user :', error);
			reject(new RapidoError(RapidoErrorCodes.genericError, "Unable to complete verification process", 500));
		})
	});
}

module.exports = new RegistrationService();
