var restify = require('restify');
var plugins = require('restify-plugins');
var setup = require('./setup');


// Startup
const db_port = 32770;
const db_host = '192.168.99.100';
const db_name = 'rapido';
const db_user = 'postgres';
const db_password = 'password';

const server_port = 8090;

let db = setup.initDB(db_host, db_port, db_name, db_user, db_password);
let server = setup.initServer();

// Initialize handlers
require('./handlers/users.js')(server, db);

// Start the server
server.listen(server_port, function () {
  console.log('%s listening at %s', server.name, server.url);
});
