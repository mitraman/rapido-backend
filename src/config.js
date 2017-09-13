const winston = require('winston');

//TODO: make all of this code programmatic
//TODO: emit log messages to tell operator where config properties were loaded from

let config = function() {
  this.configFileName = '';
  this.configJSON = {};
}

let loadObjectProperty = function(propName) {

  let envPropName = 'RAPIDO_' + propName.toUpperCase();
  let npmPropName = 'npm_package_config_' + propName.toLowerCase();

  // First check if this property exists in the environment
  if( process.env[envPropName] ) {
    try {
      let jsonObject = JSON.parse(process.env[envPropName]);
      this[propName] = jsonObject
      winston.log('info', propName + ' loaded from environment property ' + envPropName + ' with value ' + this[propName]);
    }catch(e) {
      winston.log('info', 'Unable to parse object defined in environment property ' + envPropName);
    }
  }else if( configFileJSON[propName] ) {
    this[propName] = configFileJSON[propName];
    winston.log('info', propName + ' loaded from ' + configFileName + ' with value ' + this[propName]);
  }else if( process.env[npmPropName] ) {
    try {
      let jsonObject = JSON.parse(process.env[npmPropName]);
      this[propName] = jsonObject
      winston.log('info', propName + ' loaded from environment property ' + npmPropName + ' with value ' + this[propName]);
    }catch(e) {
      winston.log('info', 'Unable to parse object defined in environment property ' + npmPropName);
    }
  }else {
    winston.log('warn', 'Unable to location configration value for property ' + propName);
  }
}

let loadProperty = function(propName, isObject) {

  let configFileJSON = this.configJSON;
  let configFileName = this.configFileName;
  let envPropName = 'RAPIDO_' + propName.toUpperCase();
  let npmPropName = 'npm_package_config_' + propName.toLowerCase();

  console.log('configFileJSON:', configFileJSON);
  console.log(this.configJSON);

  // First check if this property exists in the environment
  if( process.env[envPropName] ) {
    this[propName] = process.env[envPropName];
    winston.log('info', propName + ' loaded from environment property ' + envPropName + ' with value ' + this[propName]);
  }else if( configFileJSON[propName] ) {
    this[propName] = configFileJSON[propName];
    winston.log('info', propName + ' loaded from ' + configFileName + ' with value ' + this[propName]);
  }else if( process.env[npmPropName] ) {
    this[propName] = process.env[npmPropName];
    winston.log('info', propName + ' loaded from package.json with value ' + this[propName]);
  }else {
    winston.log('warn', 'Unable to location configration value for property ' + propName);
  }
}

config.prototype.setProperty = function(propName, value) {
  this[propName] = value;
}

config.prototype.load = function(configFile) {

  let jsonConfig = {};

  //loadProperty('port', jsonConfig, configFile);

  //loadProperty('sendgrid_API_key')

  this.port = process.env.npm_package_config_port;
  this.database = {
    host: process.env.npm_package_config_db_host,
    port: process.env.npm_package_config_db_port,
    database: process.env.npm_package_config_db_name,
    user: process.env.npm_package_config_db_user,
    password: process.env.npm_package_config_db_password
  };
  this.secret = process.env.npm_package_config_secret;
  this.nodemailer = {
    testmode: process.env.npm_package_config_nodemailer_testmode,
    options: process.env.npm_package_config_nodemailer_options,
    linkBase: process.env.npm_package_config_nodemailer_linkBase,
    paths: {
      verification: process.env.npm_package_config_nodemailer_path_verification
    }
  }

  // override npm config with json file
  if( configFile ) {
    try {
      var configJSON = require(configFile)
      if( configJSON.port ) { this.port = configJSON.port };
      if( configJSON.database.host ) { this.database.host = configJSON.database.host };
      if( configJSON.database.port ) { this.database.port = configJSON.database.port };
      if( configJSON.database.name ) { this.database.database = configJSON.database.name };
      if( configJSON.database.user ) { this.database.user = configJSON.database.user };
      if( configJSON.database.password ) { this.database.password = configJSON.database.password };
      if( configJSON.nodemailer.testmode ) { this.nodemailer.testmode = configJSON.nodemailer.testmode };
      if( configJSON.nodemailer.options ) { this.nodemailer.options = configJSON.nodemailer.options };
      if( configJSON.nodemailer.linkBase ) { this.nodemailer.linkBase = configJSON.nodemailer.linkBase };
      if( configJSON.nodemailer.paths.verification ) { this.nodemailer.paths.verification = configJSON.nodemailer.paths.verification };
      if( configJSON.secret ) { this.secret = configJSON.secret };
    }
    catch (e) {
        console.error('Unable to load file ' + configFile);
        console.error(e);
    }
  }

  // override all config with  environment variables
  if( process.env.RAPIDO_PORT ) { this.port = process.env.RAPIDO_PORT }
  if( process.env.RAPIDO_DATABASE_HOST ) { this.database.host = process.env.RAPIDO_DATABASE_HOST }
  if( process.env.RAPIDO_DATABASE_PORT ) { this.database.port = parseInt(process.env.RAPIDO_DATABASE_PORT) }
  if( process.env.RAPIDO_DATABASE_NAME ) { this.database.database = process.env.RAPIDO_DATABASE_NAME }
  if( process.env.RAPIDO_DATABASE_USER ) { this.database.user = process.env.RAPIDO_DATABASE_USER }
  if( process.env.RAPIDO_DATABASE_PASSWORD ) { this.database.password = process.env.RAPIDO_DATABASE_PASSWORD }
  if( process.env.RAPIDO_MAIL_TESTMODE ) { this.nodemailer.testmode = process.env.RAPIDO_MAIL_TESTMODE }
  if( process.env.RAPIDO_MAIL_OPTIONS ) {
    let jsonString = process.env.RAPIDO_MAIL_OPTIONS;
    try {
      let json = JSON.parse(jsonString);
      this.nodemailer.options = json;
    }catch (e) {
      console.error('Unable to parse RAPIDO_MAIL_OPTIONS enviornment value as a JSON object:', process.env.RAPIDO_MAIL_OPTIONS);
      console.error(e);
    }

  }
  if( process.env.RAPIDO_MAIL_LINKBASE ) { this.nodemailer.linkBase = process.env.RAPIDO_MAIL_LINKBASE }
  if( process.env.RAPIDO_MAIL_PATH_VERIFICATION ) { this.nodemailer.paths.verification = process.env.RAPIDO_MAIL_PATH_VERIFICATION }
  if( process.env.RAPIDO_SECRET) { this.secret = process.env.RAPIDO_SECRET }
  if( process.env.RAPIDO_SENDGRID_API_KEY) { this.sendgrid_api_key = process.env.RAPIDO_SENDGRID_API_KEY}

  this.loaded = true;
}

module.exports = new config();
