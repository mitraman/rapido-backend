var serverManager = require('./server-setup.js')

const db_config = {
  host: process.env.npm_package_config_db_host,
  port: process.env.npm_package_config_db_port,
  database: process.env.npm_package_config_db_name,
  user: process.env.npm_package_config_db_user,
  password: process.env.npm_package_config_db_password
}

const server_port = process.env.npm_package_config_port;

serverManager.start(db_config, server_port);
