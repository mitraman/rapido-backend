rapido-backend
==============

The backend API server for the [Rapido app](http://github.com/apiacademy/rapido-web)

##Setup

You'll need a postgresql database.  You can find a dockerized version at https://hub.docker.com/_/postgres/.
Modify the package.json config section with your database connection parameters.

##Run

use `npm start` to bring the server up.

##Test

use `npm test` to start the Jasmine tests.  Tests require a running postgresql database.  The test scripts create a database called rapido-test.

## API

`POST /register` - register a new user

`POST /login` - login with credentials

`GET /projects` - retrieve sketch projects for this user

`GET /projects/{id}` - retrieve a specific project
