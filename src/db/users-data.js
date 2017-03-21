var usersData = function() {
};

usersData.prototype.Register = function( user ) {
	// Just return the status let service handles success response.
	return db.query('INSERT INTO users(email, password, firstname, lastname, isactive, isverified) VALUES($1, $2, $3, $4, $5, $6) returning id',
              [user.username, user.password, user.firstname, user.lastname,  true, false]);
}
