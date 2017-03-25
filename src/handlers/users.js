"use strict";

const passport = require('passport');
const representer = require('../representers/json.js')();
const passportManager = require('../security/passport-manager.js')();
const registrationService = require('../services/registration.js');
const winston = require('winston');
const RapidoErrorCodes = require('../../src/errors/codes.js');


module.exports = {

	registrationHandler: function(req, res, next) {
		winston.log('debug', 'registrationHandler called.');
		winston.log('debug', req.body);

		if( !req.body) {
			res.send(400, representer.errorMessage('The registration request is missing a body'));
		}

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
			winston.log('debug', 'nickname property is missing.')
			res.status(400).send(representer.errorMessage("the 'nickname' property is missing from the request body"))
			return;
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
			winston.log('error', 'Unable to register', error);
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

	login: function(req, res, next) {
		// Authentication is handled by passportjs which should be included at the routing point.
		res.send(representer.responseMessage(req.user))
	}

}




/***
module.exports = function(pgDB, server) {


server.post('/login', passport.authenticate('basic', {session: false}), function(req, res) {
	console.log('/login');
	res.send(200, 'blah');
})


server.post('/login',
  passport.authenticate('basic', {session: false}),  function(req, res) {
    console.log('/login');
    res.status(200);
		console.log('here I am');
    res.send(req.user);
  }
);


server.post('/logout', function(req, res) {
		// Get the token from the request
		var bearerString = req.headers.authorization;
		var token = bearerString.substring('Bearer '.length, bearerString.length);
		// Delete this token from the session collection
        passportManager.deleteToken(token);


		res.status(200);
		res.send();
	}
);
}

***/
