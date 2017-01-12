var express = require('express');
var cors = require('cors');
var passport = require('passport');
var http = require('http');
var request = require('request');

var conn = require('./db/mongo.js');

app = express();
app.use(express.logger());

app.use(express.cookieParser());
// TODO: Add support for XML
app.use(express.bodyParser());
// TODO: Retrieve secret from environment variable
app.use(express.session({ secret: 'keyboard cat' }));
app.use(passport.initialize());
app.use(passport.session());

app.use(cors());

app.use('/assets', express.static('public'));

// Initialize the database connector
conn.init();

// Request Handlers
require('./handlers/resources.js')(app, conn);
require('./handlers/states.js')(app, conn);
require('./handlers/map.js')(app, conn);
require('./handlers/projects.js')(app, conn, authorizeUser);
require('./handlers/sketches.js')(app, conn, authorizeUser);
require('./handlers/hypernodes.js')(app, conn, authorizeUser);
require('./handlers/alps.js')(app, conn, authorizeUser);
require('./handlers/users.js')(app, conn);

// Setup Passport routines for user authentication
var passportManager = require('./security/passport-manager.js');
passportManager(conn);

// ****** Authorization Routines

// Make sure that the user is authorized to use an object
// Authorization is based on user id and project id for now.
// Pre-req: An authenticated user
function authorizeUser(req, res, next) {
    var projectId = req.params.projectId;    
    var user = req.user;
    
    //console.log('authorizeUser');
    //console.log(projectId);
    //console.log(user);
    
    // No project Id was found, so reject the request
    if( !projectId ) {
        //console.log('rejecting...');
        res.send(403, 'no project id found');
    }
    
    // Make sure this user has access to the project
    conn.collection('projects').find({_id: mongo.helper.toObjectID(projectId), owner: user}).toArray(function (err, projects) {
        //console.log('inside query');
        //console.log(projects);
        //console.log(projects.length);
        
			if( err == null && projects.length > 0 ) {                    
                // Everything is good, so continue processing
                //console.log('az passed.');
                next();
            } else {
                res.send(403, 'user does not have access to this project.');
            }            			            
	});            
}

  
/*
app.get('/', function(req, res){
    res.send('Hello World');
});
*/


var port = process.env.PORT || 8081;
app.listen(port);
console.log('Express server started on port %s', port);

