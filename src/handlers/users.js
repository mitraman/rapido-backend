var passport = require('passport');
var representer = require('../representers/json.js')();
var passportManager = require('../security/passport-manager.js')();
var userMgmt = require('../user-mgmt.js');


module.exports = {

	register: function(req, res, next) {
		if( !req.body) {
			res.send(400, representer.errorMessage('The registration request is missing a body'));
		}

		// Create the user
		var username = req.body.username;
		var password = req.body.password;

		userMgmt.register(username, password, function(err, result) {
			if( err ) {
				res.send(err.status, representer.errorMessage(err.message));
			} else {
				res.send(representer.responseMessage(result));
			}
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
