
var bcrypt = require('bcrypt-nodejs');

function validate(username, password, firstname, lastname) {

}

register = function(username, password, firstname, lastname) {
  // Validate User inputs.
	//if(userService.validate(username, password, firstname, lastname))	return;

  // Encrypt the password before storing. Need to have alternate encyrption in future.
	user.password = bcrypt.hashSync(user.password);


}
