var passport = require('passport');
var representer = require('../representers/json.js');

var passportManager = require('../security/passport-manager.js')();

/** TODO: Move the tokens to a redis database so we can start and stop the app server without impacting user sessions **/

module.exports = function(server, store) {

/*
Deprecated subscription function

server.post('/subscribe', function( req, res ) {
    var email = req.body.email;
    var firstName = req.body.firstName;
    var lastName = req.body.lastName;

    //console.log('subscribe');
    //console.log(email);
    //console.log(firstName);
    //console.log(lastName);

    var data = {
                "apikey": "139c0c169651b04cb531a8c9ace048e4-us9",
                "id": "d96e7fec0f",
                "email": {
                    "email": email
                },
                "double_optin": false,
                "send_welcome": true,
                "merge_vars": {
                    "FNAME": firstName,
                    "LNAME": lastName
                }
    };

    request.post({
        uri:'https://us9.api.mailchimp.com/2.0/lists/subscribe',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
        }, function(error, response, body) {
            if( !error && response.statusCode === 200 ) {
                res.send(200);
            } else {
                //console.log(error);
                //console.log(response);
                //console.log(body);
                res.send(500);
            }
    });

});
*/

// Registration
server.post('/register', function( req, res ) {

	// Create the user
	var username = req.body.username;
	var password = req.body.password;

	////console.log('cleartext: %s',password);

	bcrypt.hash(password, null, null, function(err, hash) {
		////console.log('hashed: %s',hash);
		var user = { username: username, password: hash };
		////console.log(user);
		conn.collection('users').insert(user, function (err, result) {
			if( err ) {
				//console.error(err);
				res.send(500, { 'reason' : 'Unable to connect to database' });
			} else {
				//TODO: Fix the register result.
				var userResult = [{ username: result.username }]
				res.send(userResult);
			}
		});
	})


});

server.post('/login',
		  passport.authenticate('basic', {session: false}),  function(req, res) {
              //console.log('/login');
			  res.status(200);
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
