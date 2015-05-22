var passport = require('passport')
, BasicStrategy = require('passport-http').BasicStrategy
, BearerStrategy = require('passport-http-bearer').Strategy;
var bcrypt = require('bcrypt-nodejs');
var crypto = require('crypto');

module.exports = function(conn) {

// TODO: Use a better token mechanism - maybe L7?
var tokens = {};

function findByToken(token, callback) {
	////console.log(token);	
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
		
		conn.findAll('users', {username: username}, function (err, users) {
            if( users.length === 0 ) {
				return done(null, false, { message: 'invalid username/password combination'} );
			}
            var user = users[0];
			////console.log(user);
			bcrypt.compare(password, user.password, function(err, res) {
				if( res ) {
					////console.log('AUTH PASSED.');
					var bearerToken = generateToken(user._id, function(token) {
						////console.log('token: %s', token);
						var credential = {
                                id: user._id,
								username: username,
								token: token
						};
						return done( null, credential);
					});					
				}else {
                    //console.log(res);
                    //console.log(err);
					//console.log('AUTH FAILED.');
					return done(null, false, { message: 'invalid username/password combination'} );
				}
			});
			
		});			    	 
}));

return {
    deleteToken: function(token) {
        delete tokens[token];
    }
}
}
