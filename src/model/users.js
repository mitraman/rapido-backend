const Promise = require('bluebird');
const dataAccessor = require('../db/DataAccessor.js');

const users = function() {};

let db = dataAccessor.getDb();

users.create = function( user ) {

  return db.one({
    name: "create-user",
    text: "INSERT INTO users(email, password, firstname, lastname, isactive, isverified) VALUES($1, $2, $3, $4, $5, $6) returning id",
    values: [user.email, user.password, user.firstName, user.lastName,  true, false]
  });

}

//Allways use the id as as the filter for updating user data
users.update = function( params, id ) {

  if( !id ) {
    throw {
      name: Error,
      message: "No id provided for update operation."
    }
  }

  let queryString = "UPDATE USERS SET";
  let queryParams = [];
  let queryName = "update-users-";

  function queryBuilder(paramName, valueName) {
    if( !valueName ) {
      valueName = paramName
    }
    if( queryParams.length > 0 ) { queryString += ", "; }
    queryParams.push(params[paramName]);
    queryString += " " + valueName + "=$" + queryParams.length;
    queryName += "-"+valueName;
  }

  if( params ) {
      if( params.isVerified ) {
        queryBuilder("isVerified", "isverified");
      }
      if( params.isActive ) {
        queryBuilder("isActive", "isactive");
      }
  }

  if( queryParams.length === 0 ) {
    throw {
      name: Error,
      message: "No parameters provided for update operation."
    }
  }

  queryParams.push(id);
  queryString += " where id=$" + queryParams.length;

  //  console.log(queryName);
  //  console.log(queryString);
  //  console.log(queryParams);

  return db.none({
    name: queryName,
    text: queryString,
    values: queryParams
  });

}

users.find = function( params ) {

  let queryString = "SELECT * FROM USERS WHERE";
  let queryParams = [];
  let queryName = "find-users-by";

  function queryBuilder(paramName, valueName) {
    if( !valueName ) {
      valueName = paramName
    }
    if( queryParams.length > 0 ) { queryString += " AND"; }
    queryParams.push(params[paramName]);
    queryString += " " + valueName + "=$" + queryParams.length;
    queryName += "-"+valueName;
  }

  if( params ) {
      if( params.id ) {
        queryBuilder("id");
      }
      if( params.email ) {
        queryBuilder("email");
      }
      if( params.isVerified ) {
        queryBuilder("isVerified", "isverified");
      }
  }

  if( queryParams.length === 0 ) {
    throw {
      name: Error,
      message: "No parameters provided for find operation"
    }
  }

  // console.log(queryName);
  // console.log(queryString);
  // console.log(queryParams);

  //TODO: Should this be one or many?  Should I create two different access methods?
  return db.one({
    name: queryName,
    text: queryString,
    values: queryParams
  });

}

module.exports = users;
