const Promise = require('bluebird');
const winston = require('winston');
const RapidoError = require('../errors/rapido-error.js');
const RapidoErrorCodes = require('../errors/codes.js');
const config = require('../config.js')
const https = require('https');

let EmailService = function () {
}

EmailService.prototype.sendEmail = function(emailAddress, recipientName, subject, html, text) {

  winston.log('debug', '[EmailService] sendVerificationEmail called');

  return new Promise( (resolve, reject) => {

    let apiKey = config.sendgrid_api_key;

    const options = {
      host: 'api.sendgrid.com',
      path: '/v3/mail/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      }
    };


    let jsonData = {};
    jsonData.personalizations = [
      {
        to: [
          {
            email: emailAddress,
            name: recipientName
          }
        ],
        subject: subject
      }
    ];

  jsonData.from = { email: 'ronnie@rapidodesigner.com', name: 'Ronnie Mitra'}
  jsonData.reply_to = { email: 'ronnie@rapidodesigner.com', name: 'Ronnie Mitra'}
  jsonData.subject = subject;
  jsonData.content = [
    {
      "type": "text/plain",
      "value": text
    },
    {
      "type": "text/html",
      "value": html
    }
  ]

    const postData = JSON.stringify(jsonData);

    winston.log('debug', '[EmailService] sendVerificationEmail sending request to ' + options.host + options.path);

    // connect with HTTPS request client and include a response handler
    const req = https.request(options, (response) => {
      winston.log('debug', '[EmailService] sendVerificationEmail sendGrid returned ', response.statusCode);
      if( response.statusCode === 202) {
        resolve();
      }else {
        // Read the response body
        let responseBody = '';
        response.on('data', (chunk) => {
          responseBody += chunk;
        })

        response.on('end', () => {
          console.log('end');
            reject(new RapidoError(RapidoErrorCodes.emailTransmissionError, 'SendGrid API returned ' + response.statusCode + ': ' + responseBody));
        })


      }
    });

    // Write the POST data
    req.write(postData);
    req.end();



  })
}

module.exports = new EmailService();
