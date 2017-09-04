const Promise = require('bluebird');
const dataAccessor = require('../db/DataAccessor.js');
const winston = require('winston');
const RapidoError = require('../errors/rapido-error.js');
const RapidoErrorCodes = require('../errors/codes.js');

const userVerification = function() {};

userVerification.create = function( userId, token ) {

  const db = dataAccessor.getDb();
  return db.one({
    name: "create-verification",
    text: "INSERT INTO user_verify(userid, verifytoken) VALUES($1, $2) returning id",
    values: [userId, token]
  });

}

userVerification.findById = function( id ) {
  const db = dataAccessor.getDb();
  return db.one({
    name: "find-verification-by-id",
    text: "SELECT * from user_verify WHERE userid=$1",
    values: [id]
  });
}

userVerification.findByToken = function( token ) {

  const db = dataAccessor.getDb();
  return db.one({
    name: "find-verification",
    text: "SELECT * FROM user_verify WHERE verifytoken=$1",
    values: [token]
  });
}

userVerification.delete = function( params ) {
  let query = 'DELETE FROM user_verify WHERE userid=$1';
  const db = dataAccessor.getDb();

  let queryString = "DELETE FROM user_verify WHERE";
  let queryParams = [];
  let queryName = "delete-verify-by";

  function queryBuilder(paramName, valueName) {
    if( !valueName ) {
      valueName = paramName
    }
    if( queryParams.length > 0 ) { queryString += " AND"; }
    queryParams.push(params[paramName]);
    queryString += " " + valueName + "=$" + queryParams.length;
    queryName += "-"+valueName;
  }

  if( params.token ) {
    queryBuilder("token", "verifytoken");
  }
  if( params.userId ) {
    queryBuilder("userId", "userid");
  }

  if( queryParams.length === 0 ) {
    throw new RapidoError(RapidoErrorCodes.invalidField, "No parameters provided for delete verification operation")
  }

  return db.none({
    name: queryName,
    text: queryString,
    values: queryParams
  });
}


module.exports = userVerification;
