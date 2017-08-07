/**
 * Utility functions for the handler tests
 *
 **/
 "use strict";

 const Promise = require('bluebird');
 const request = require("request");
 const config = require('../../src/config.js');
 const dataAccessor = require('../../src/db/DataAccessor.js');
 const bcrypt = require('bcrypt-nodejs');
 const authentication = require('../../src/security/authentication.js')

 const server_port = config.port;
 const urlBase = 'http://localhost:' + server_port + '/api';
 const registrationUrl = urlBase + '/register';
 const loginUrl = urlBase + '/login';
 let headers = {
   'Content-Type': 'application/json'
 };


 let registerAndGenerate = function(email, password) {
   const db = dataAccessor.getDb();

   return new Promise( (resolve, reject) => {
     // Encrypt the password
     bcrypt.hash(password, null, null, (err, encryptedPassword) => {
       if( err ) {
         reject(err);
       }else {

         db.one('insert into USERS (email, password) VALUES ($1, $2) returning id',
        [email, encryptedPassword])
         .then( result => {
           let token = generateLoginToken(result.id, email);
           resolve({
             userId: result.id,
             token: token
           })
         }).catch( e => {
           reject(e);
         })
       }
     })
   });
 }

 let generateLoginToken = function(id, email) {
   let jwtToken = authentication.generateJWT({id: id , email: email});
   return jwtToken;
 }

 // Deprecated, switched to working directly with the database instead
 let _registerAndLogin = function(testName) {
  return new Promise( function(resolve, reject) {

    const max = 32767;
    const min = 1;
    let randomId = Math.floor(Math.random() * (max - min + 1)) + min;
    let email = "random" + randomId + "@email.com";
    let password = "password12";
    let userid, token;

    // Create a new user that we can use for testing
    request.post(
      {
        url: registrationUrl,
        headers: headers,
        json: {
          fullname: "Generated Test",
          nickname: "autogen",
          password: password,
          email: email
        }
      },function(err, res, body) {
        if( err ) {
          reject(err);
          return;
        } if( res.statusCode != 200 ) {
          reject("Unexpected response for registration of user: " + body);
          return;
        }
        // save the user ID
        userid = body.newUser.id;

        // Login and save the token
        request.post(
          {
            url: loginUrl,
            headers: headers,
            json: {
              password: password,
              email: email
            }
          },function(err, res, body) {
            if( err) {
              reject(err);
            } else if( res.statusCode != 200 ) {
              reject('Unexpected response when logging in');
            } else {
              token = body.token;
              resolve({ userId: userid, token: token } );
            }
        })
      })
    });
 }


module.exports = {
  registerAndLogin: registerAndGenerate
}
