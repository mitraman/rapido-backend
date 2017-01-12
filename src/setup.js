var restify = require('restify');
var plugins = require('restify-plugins');
var pgp = require('pg-promise')();

exports.initDB = function(db_host, db_port, db_name, db_user, db_password) {

  var db_config = {
    host: db_host,
    port: db_port,
    database: db_name,
    user: db_user,
    password: db_password
  };

  var db = pgp(db_config);

  return db;
}


exports.initServer = function() {

  const server = restify.createServer({
    name: 'Rapido-API',
    version: '1.0.0'
  });

  server.use(plugins.acceptParser(server.acceptable));
  server.use(plugins.queryParser());
  server.use(plugins.bodyParser());

  return server;
}
