
![Build Status](https://travis-ci.org/apiacademy/rapido-backend.svg?branch=master)

rapido-backend
==============

The backend API server for the [Rapido app](http://github.com/apiacademy/rapido-web)

##Setup

You'll need a postgresql database.  You can find a dockerized version at https://hub.docker.com/_/postgres/.

Edit `rapido.json` and `rapido-test.json` to configure the database connection and server port parameters.

##Run

use `npm start` to bring the server up.

##Test

use `npm test` to start the Jasmine tests.  Tests require a running postgresql database.  The test scripts create a database called rapido-test.  We use Istanbul to check for code coverage and contributions MUST have a coverage rate of 100%.  If you have code that is impossible to test you can add a statement to [exclude it from testing](https://github.com/gotwarlost/istanbul/blob/master/ignoring-code-for-coverage.md)

## API

`POST /register` - register a new user

`POST /login` - login with credentials

`GET /projects` - retrieve sketch projects for this user

`GET /projects/{id}` - retrieve a specific project
