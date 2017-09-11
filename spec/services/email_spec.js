"use strict";

const winston = require('winston');
const EmailService = require('../../src/services/Email.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const Config = require('../../src/config.js');
const nock = require('nock');

describe('services/verification', function() {

  beforeEach(function() {
  });

  it('should send a verification email using the sendgrid API', function(done) {
    const expectedBody = {
      "personalizations": [
        {
          "to": [
            {
              "email": "testuser@email.com",
              "name": "Test User"
            }
          ],
          "subject": "Welcome to Rapido"
        }
      ],
      "from": {
        "email": "ronnie@rapidodesigner.com",
        "name": "Ronnie Mitra"
      },
      "reply_to": {
        "email": "ronnie@rapidodesigner.com",
        "name": "Ronnie Mitra"
      },
      "subject": "Welcome to Rapido",
      "content": [
        {
          "type": "text/plain",
          "value": "Hello, world!"
        },
        {
          "type": "text/html",
          "value": "<html><p>Hello, world!</p></html>"
        }
      ]
    }

    try {
    const sendgrid = nock('https://api.sendgrid.com')
                .post('/v3/mail/send', expectedBody)
                .reply(202);
    }catch(e) {
      fail(e);
    }

    EmailService.sendEmail('testuser@email.com', 'Test User', 'Welcome to Rapido', '<html><p>Hello, world!</p></html>', 'Hello, world!')
    .then( result => {
    }).catch( e => {
      fail(e);
    }).finally(done);
  })

  it('should use an API token from the config object to form a Authorization header', function(done) {

    // Set the API token value for the config object
    Config.setProperty('sendgrid_api_key', 'my_api_token');
    const sendgrid = nock('https://api.sendgrid.com', {
                reqheaders: {
                  'authorization': 'Bearer my_api_token'
                }})
                .post('/v3/mail/send')
                .reply(202);

    EmailService.sendEmail('testuser@email.com', 'Test User', 'Welcome to Rapido', '<html><p>Hello, world!</p></html>', 'Hello, world!')
    .then( result => {
    }).catch( e => {
      fail(e);
    }).finally(done);

  })



  it('should send a RapidoError if the Sendgrid API returns a non 202 response', function(done) {

    const sendgrid = nock('https://api.sendgrid.com')
                .post('/v3/mail/send')
                .reply(400);

    EmailService.sendEmail('testuser@email.com', 'Test User', 'Welcome to Rapido', '<html><p>Hello, world!</p></html>', 'Hello, world!')
    .then( result => {
      fail('expected this email call to be rejected');
    }).catch( e => {
      expect(e).toBeDefined();
      expect(e.name).toBe('RapidoError');
      expect(e.code).toBe(RapidoErrorCodes.emailTransmissionError);
    }).finally(done);

  })

  // Use this to do a quick test of the real API call, (you'll need a real API key and a recipient address)
  // it('should make a real API call to sendgrid', function(done) {
  //   Config.setProperty('sendgrid_api_key', '');
  //   EmailService.sendEmail('', 'First Last', 'Testing sendgrid', '<html><p>Hello</p></html>', 'This is a test');
  // })

})
