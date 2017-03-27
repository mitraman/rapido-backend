/**
 * Parses and stores emails for unit tests
 *
 **/
 "use strict";

 const SMTPServer = require('smtp-server').SMTPServer;
 const Envelope = require('envelope');
 const winston = require('winston');

 let emails = {};

 let findEmail = function(address) {
   return emails[address];
 }

 let mailReader = function(stream, session, callback) {
   let emailData = '';

   winston.log('debug', 'received new email');

   stream.on('readable', ()=> {
     let data = stream.read();
     if( data ) {
       var part = data.toString();
       emailData += part;
     }
   });

   stream.on('end',()=> {
     let email = new Envelope(emailData);
     winston.log('debug', 'storing email to ' + email.header.to.address + ' in memory:',email);
     emails[email.header.to.address] = email;
     callback();
   });
 }

let start = function() {
   // Start the SMTP server for testing email functions
   let smtpServer = new SMTPServer({
     authOptional: true,
     onData: mailReader
   });
   smtpServer.listen(2525);
}

module.exports = {
  start: start,
  findEmail: findEmail
}
