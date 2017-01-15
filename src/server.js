"use strict";

const serverManager = require('./server-setup.js');

const dbConfig = {
  host: process.env.npm_package_config_db_host,
  port: process.env.npm_package_config_db_port,
  database: process.env.npm_package_config_db_name,
  user: process.env.npm_package_config_db_user,
  password: process.env.npm_package_config_db_password,
};

const serverPort = process.env.npm_package_config_port;

serverManager.start(dbConfig, serverPort);
