"use strict";

var passport = require('passport')
, BasicStrategy = require('passport-http').BasicStrategy
, BearerStrategy = require('passport-http-bearer').Strategy;
var bcrypt = require('bcrypt-nodejs');
var crypto = require('crypto');
var da = require('../db/DataAccessor');

/***
This is a temporary authenticator.  It needs to be replaced by a
production-grade system
***/

module.exports = function() {

var tokens = {};

function findByToken(token, callback) {
	var userId = tokens[token];
	////console.log(userId);
	callback(null, userId);
}

function generateToken(userId, callback) {
	var shasum = crypto.createHash('sha1');
	var random = Math.random().toString();
	var hash = shasum.update(userId+random).digest('base64');
	// store the token
	tokens[hash] = userId;
	////console.log(hash);
	callback(hash);
}

passport.use(new BearerStrategy({
	},
	function(token, done) {
		process.nextTick(function() {
			findByToken(token, function(err, user) {
		        if (err) { return done(err); }
		        if (!user) { return done(null, false); }
		        return done(null, user);
		    })
		});
}));


passport.use(new BasicStrategy({
	},
	function(username, password, done) {

		////console.log('username: %s',username);
		////console.log('password: %s',password);

		console.warn('WARNING: This is not a production-grade authentication system!');

		da.db.one("select * from users where uname=$1", username)
    .then(function (data) {
			bcrypt.compare(password, data.password, function(err, res) {
				if( res ) {
					////console.log('AUTH PASSED.');
					var bearerToken = generateToken(data.id, function(token) {
						////console.log('token: %s', token);
						var credential = {
								id: data.id,
								username: username,
								token: token
						};
						return done( null, credential);
					});
				}else {
					return done(null, false, { message: 'invalid username/password combination'} );
				}
			});
    })
    .catch(function (error) {
        return done(null, false, { message: 'invalid username/password combination'} );
    });
}));

return {
    deleteToken: function(token) {
        delete tokens[token];
    }
}
}
