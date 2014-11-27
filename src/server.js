var flash = require('connect-flash');
var express = require('express'),
app = express();

var cors = require('cors');

var passport = require('passport')
, BasicStrategy = require('passport-http').BasicStrategy
, BearerStrategy = require('passport-http-bearer').Strategy;

var mongo = require('mongoskin');
var bcrypt = require('bcrypt-nodejs');

var crypto = require('crypto');

var http = require('http');

app.use(express.logger());

app.use(express.cookieParser());
// TODO: Add support for XML
app.use(express.bodyParser());
// TODO: Retrieve secret from environment variable
app.use(express.session({ secret: 'keyboard cat' }));
app.use(passport.initialize());
app.use(passport.session());
//app.use(flash());

app.use(cors());

app.use('/assets', express.static('public'));

var connUrlString = process.env.MONGO_USERNAME + ":" + process.env.MONGO_PASSWORD + "@" + process.env.MONGO_URL;
console.log(connUrlString);
//var conn = mongo.db(connUrlString, {auto_reconnect: true});
var conn = mongo.db('mongodb://localhost:27017/apidesign');

var alpsParser = require('./alps/alps.js');


// Handlers
require('./handlers/resources.js')(app, conn);
require('./handlers/map.js')(app, conn);
  
app.get('/', function(req, res){
    res.send('Hello World');
});

// Registration
app.post('/register', function( req, res ) {
	
	// Create the user
	var username = req.body.username;
	var password = req.body.password;
	
	//console.log('cleartext: %s',password);
	
	bcrypt.hash(password, null, null, function(err, hash) {
		//console.log('hashed: %s',hash);
		var user = { username: username, password: hash };
		//console.log(user);
		conn.collection('users').insert(user, function (err, result) {
			if( err ) {
				//console.error(err);
				res.send(500, { 'reason' : 'Unable to connect to database' });
			} else {
				//TODO: Fix the register result.
				var userResult = [{ username: result.username }] 
				res.send(userResult);	
			}			
		});	
	})
	
	
});

// Authentication

// TODO: Use a better token mechanism - maybe L7?
var tokens = {};

function findByToken(token, callback) {
	console.log(token);	
	var userId = tokens[token];
	console.log(userId);
	callback(null, userId);
}

function generateToken(userId, callback) {
	var shasum = crypto.createHash('sha1');
	var random = Math.random().toString();
	var hash = shasum.update(userId+random).digest('base64');
	// store the token 
	tokens[hash] = userId;
	console.log(hash);
	callback(hash);
}

passport.use(new BearerStrategy({
	},
	function(token, done) {
		process.nextTick(function() {
			findByToken(token, function(err, user) {
		        if (err) { return done(err); }
		        if (!user) { return done(null, false); }
		        return done(null, user);
		    })
		});
}));


passport.use(new BasicStrategy({
	},
	function(username, password, done) {
		
		console.log('username: %s',username);
		console.log('password: %s',password);
		
		conn.collection('users').findOne({username: username}, function (err, user) {
			if( user === null || user === undefined ) {
				return done(null, false, { message: 'invalid username/password combination'} );
			}
			console.log(user);
			bcrypt.compare(password, user.password, function(err, res) {
				if( res ) {
					console.log('AUTH PASSED.');
					var bearerToken = generateToken(user._id, function(token) {
						console.log('token: %s', token);
						var credential = {
                                id: user._id,
								username: username,
								token: token
						};
						return done( null, credential);
					});					
				}else {
                    console.log(res);
                    console.log(err);
					console.log('AUTH FAILED.');
					return done(null, false, { message: 'invalid username/password combination'} );
				}
			});
			
		});			    	 
}));


app.post('/login',
		  passport.authenticate('basic', {session: false}),  function(req, res) {			  
              console.log('/login');
			  res.status(200);
			  res.send(req.user);
		  }
);

app.post('/logout', passport.authenticate('bearer', {session: false}), function(req, res) {
		// TODO: implement logic to logout the active user and delete the token
	}
);


// Authorization

// Make sure that the user is authorized to use an object
// Authorization is based on user id and project id for now.
// Pre-req: An authenticated user
function authorizeUser(req, res, next) {
    var projectId = req.params.projectId;    
    var user = req.user;
    
    console.log('authorizeUser');
    console.log(projectId);
    console.log(user);
    
    // No project Id was found, so reject the request
    if( !projectId ) {
        console.log('rejecting...');
        res.send(403, 'no project id found');
    }
    
    // Make sure this user has access to the project
    conn.collection('projects').find({_id: conn.ObjectID.createFromHexString(projectId), owner: user}).toArray(function (err, projects) {
        console.log('inside query');
        console.log(projects);
        console.log(projects.length);
        
			if( err == null && projects.length > 0 ) {                    
                // Everything is good, so continue processing
                console.log('az passed.');
                next();
            } else {
                res.send(403, 'user does not have access to this project.');
            }            			            
	});            
}



// API

// RESOURCES
/**
app.get('/projects/:projectId/resources', passport.authenticate('bearer', {session: false}), function(req, res) {
    var projectId = req.params.projectId;
   
    // How do we chain promises?
    isOwner(projectId, req.user)
    .then(retrieve('resources', {'project' : projectId})).then(function() {
    }, 
   function(error) {
   });
        
});
**/

// STATES
app.get('/projects/:projectId/states', passport.authenticate('bearer', {session: false}), authorizeUser, function(req, res) {
    
	//TODO: turn this AZ step into an express processor
  var projectId = req.params.projectId;
    console.log(projectId);
    
    if( projectId == null ) {
        res.send(400, '{"message": "invalid project ID"}');
    }
  
   conn.collection('tasks').find({project: projectId}).toArray(function (err, tasks) {
	   if( err ) {
		   console.log(err);
		   res.status(500);
		   res.send("Unable to retrieve data.");
	   }else {
		   // Get transitions and include them in the object.
		   // TODO: When I re-engineer this backend, I should use RSVP or a relational database or osmething better than this crap...
		   console.log(tasks);
		   console.log(tasks.length);
		   
		   if( tasks.length === 0 ){
			   res.send(200, tasks);
		   }
		   
		   var responseCounter = tasks.length;
		   stateMap = [];
		   for( var i = 0; i < tasks.length; i++) {
			   stateMap[tasks[i]._id.toString()] = i;
		   }
		   
		   
		   function addTransition(error, transitions) {
			   if( error != null ) {
				   console.log(error);
				   res.status(500);
				   res.send('seomthing went wrong');
			   } else {
				   responseCounter--;
				   if( transitions.length > 0 ) {
					   var index = stateMap[transitions[0].source];
					   tasks[index].transitions = transitions;
				   }
				   if( responseCounter === 0 ) {
					   res.send(tasks);
				   }
			   }
		   }
		   
		   for( var i = 0; i < tasks.length; i++ ) {			   
			   var taskId = tasks[i]._id.toString();			   
			   
			   conn.collection('transitions').find({source: taskId}).toArray(function (err, transitions) {		
				   //console.log(transitions);
				   addTransition(null, transitions);   
			   });			   
		   }		   
		   
		       
	   }
    });   
});


app.put('/projects/:projectId/states/:id', passport.authenticate('bearer', {session: false}), authorizeUser, function(req, res) {
	// replace an existing state object
	
	//console.log(req.body);
	//console.log(req.params.id);
	
	var task = req.body.task;
    var title = task.title;
    var description = task.description;    
    var responseData = task.response;
    var methods = task.methods;
    var transitions = task.transitions;
    var url = task.url;    
    var id = req.params.id;
    
    var projectId = req.params.projectId;
    task["project"] = projectId;
	
	console.log(task);
	

	//TODO
	/*****
	// make sure that the transitions array is valid
	conn.collection('transitions').find({source: taskId}).toArray(function (err, storedTransitions) {
		// convert this array into a hash map
		var storedTransitionsHash = {};
		for( var i = 0; i < storedTransitions.length; i++ ) {
			storedTransitionsHash[storedTransitions[i]._id] = storedTransitions[i];						
		}
		
		for( var i = 0; i < transitions.length; i++ ) {
			var transition = transitions[i];
			if( storedTransitionsHash[transition.id] === null ) {
				// We don't have a record of this transition.  For now we aren't checking the case where a resource is taking over
				// an existing transition.
				res.status(400, '{"message" : "Invalid transition id' + transition.id + '"' );
			}else {
				// We have this transition, should it be updated?
				if( )
			}
		}
		
		
	}
	****/
	conn.collection('tasks').updateById(conn.ObjectID.createFromHexString(id), task, function (err, post) {
		if( err ) {
			res.status(500);
			res.send('{"message" : "Unable to store data in database."}');
			console.log(err);
		}else {
						
			res.send(200, post);
		}
        	        
    });
	
	// Update the mock listeners
	registerMockListeners();
	
});

app.post('/projects/:projectId/states', passport.authenticate('bearer', {session: false}), authorizeUser, function(req, res){
	
	// TODO: Make sure this user is authorized to make changes to this project.
	// TODO: Validate that the project exists, right now it is accepting any string.
	
    // Store a newly created task object
    console.log(req.body);
    var task = req.body.task;
    var title = task.title;
    var description = task.description;
    var requestData = task.request;
    var responseData = task.response;
    var links = task.links;
    var url = task.url;
    var id = task.nodeId;
    var methods = task.methods;
    
    task["project"] = req.params.projectId;
    
    console.log(id);
    // Store object in database
    if( id === undefined) {
    	console.log(task);
        conn.collection('tasks').insert(task, function (err, post) {
        console.log('Error: ' + err);
        console.log('Post:' + post);
        
        // TODO: return the new node id
        res.send(post);        
        });    
    }else {
    	// TODO: What is this all about?
        conn.collection('tasks').updateById(conn.ObjectID.createFromHexString(id), task, function (err, post) {
            console.log('Error: ' + err);
        console.log('Post:' + post);
        
        // TODO: return the updated node id
        res.send(post);        
        });    
    }
    
    registerMockListeners();
    
       
});

//TODO: Update this with project and auth support
app.delete('/projects/:projectId/states/:id', passport.authenticate('bearer', {session: false}), authorizeUser, function(req,res) {
	var id = req.params.id;
	var projectId = req.params.projectId;
	
	conn.collection('tasks').remove({_id: conn.ObjectID.createFromHexString(req.params.id)}, function (err, task) {
		conn.collection('transitions').remove({source: id}, function( err, task) {
			if( err != null ) {
				console.log('unable to delete transitions');
				console.log(err);
			}
		})
       res.send('{ "status" : "deleted" }');       
    });	   	
})

// TRANSITIONS
app.post('/projects/:projectId/transitions', passport.authenticate('bearer', {session: false}), authorizeUser, function(req, res){
//	app.post('/projects/:projectId/transitions', function(req, res){
	
    // Store a newly created transition object
        
    console.log(req.body);
    //var transition = req.body.transition;
    var title = req.body.title;
    var description = req.body.description;
    var source = req.body.source;
    var target = req.body.target;
    var contentType = req.body.contentType;
    var url = req.body.url;
    var method = req.body.method;
    
    //TODO: update the methods allowed on the target object    
    
    var transition = {
    		title: title,
    		description: description,
    		source: source,
    		target: target,
    		contentType: contentType,
    		url: url,
    		method: method
    };
    
    transition["project"] = req.params.projectId;
   
    	console.log(transition);
        conn.collection('transitions').insert(transition, function (err, post) {
        console.log('Error: ' + err);
        console.log('Post:' + post);
        console.log(post);
        
        // TODO: return the new transition id
        res.send(post);        
        });
        
        // update the links of the source
    
    registerMockListeners();
    
       
});

//TODO: we should be validating against project ID here.
app.delete('/transitions/:transitionId', passport.authenticate('bearer', {session: false}), authorizeUser, function(req, res){
	var transitionId = req.params.transitionId;
	
		conn.collection('transitions').remove({_id: conn.ObjectID.createFromHexString(transitionId)}, function( err, task) {
			if( err != null ) {
				console.log('unable to delete transitions');
				console.log(err);
				res.send(500, 'failed.')
			} else {
				res.send('{ "status" : "deleted" }');
			}
		})                 
	
});

// get a list of ALPS profiles
app.get('/ALPS/profiles', function(req, res) {
	conn.collection('alps').find().toArray(function (err, profiles) {
	       	res.send(profiles);	       
	 });
});

// get a specific ALPS profile
// TODO: should this be access controlled?
app.get('/ALPS/profiles/:profileId', function(req, res) {
	conn.collection('alps').find({_id: conn.ObjectID.createFromHexString(req.params.profileId) }).toArray(function (err, profiles) {
	       	res.send(profiles);	       
	 });
});

// get the global list of ALPS vocabulary
app.get('/ALPS/vocabulary', function(req, res) {
    var vocabulary = {};
	conn.collection('alps').find().toArray(function (err, profiles) {
                
        // Create a global list by appending each vocab object to our global object
        for( var i = 0; i < profiles.length; i++ ) {
            var profile = profiles[i];
            if( profile.vocabulary ) {                
                var profileVocabulary = profile.vocabulary;
                var vocabKeys = Object.keys(profileVocabulary);
                for( var j = 0; j < vocabKeys.length; j++ ) {
                    var key = vocabKeys[j];
                    //TODO: deal with name collisions
                    vocabulary[key] = profileVocabulary[key];
                }
            }
        }
	   	res.send(vocabulary);	       
	 });
});


// create a new ALPS profile	
app.post('/ALPS/profiles', function(req, res) {
	var profile = req.body.profile;
	console.log(profile);
	var name = profile.name;
	var doc = profile.doc;
    var format = profile.format;
	var representation = profile.representation;
    
    if( format != 'xml' && format != 'json' ) {
        res.send(400, "invalid profile format");
        return;
    }
    
    alpsParser(format, doc, function(error, vocabulary) {
        
        if( error ) {
            res.send(500, "unable to parse ALPS profile");
        } else {
            profile.vocabulary = vocabulary;                        
        }
              
        conn.collection('alps').insert(profile, function (err, post) {        
            // TODO: return the new profile id
            if( err === null ) {
                var id = post._id;
                res.send(id);       
            } else {
                res.status(500);
                res.send(err);
            }                 
        })
        
    });


	
	;    
});

// update an ALPS profile
app.put('/ALPS/:profileId', function(req, res) {
    
    var profileId = req.params.profileId;
    
    var name = req.body.name;
    var doc = req.body.doc;
    var format = req.body.format;
    
    var profile = {        
        name: name,
        doc: doc,
        format: format
    }
    
    console.log(req.body);
    console.log(req.body.name);
    console.log(profile);
    
    conn.collection('alps').updateById(conn.ObjectID.createFromHexString(profileId), profile, function (err, post) {
		if( err ) {
			res.status(500);
			res.send('{"message" : "Unable to store data in database."}');
			console.log(err);
		}else {
						
			res.send(200, post);
		}
        	        
    });
});

app.get('/ALPS/external', function(req, res) {
    
    var href = req.query.href;
    console.log(href);
        
    if(href.substr(0, 7)==='http://') {                
        var suffix = href.substr('http://'.length, href.length);
        
        var pathLocation = suffix.indexOf("/");
        var host = suffix;
        var path = "";
        
        if( pathLocation > -1 ) {
            host = suffix.substr(0, pathLocation);
            path = suffix.substr(pathLocation, suffix.length);                               
        }
        console.log('values:');
        console.log(host);
        console.log(path);        
        
        var options = {
            host: host, 
            path: path,
            method: 'GET'
        }
        
        console.log('making call...');
        var req = http.request(options, function(response) {
            var str = '';

            //another chunk of data has been recieved, so append it to `str`
            response.on('data', function (chunk) {
                console.log(chunk);
                str += chunk;
            });

            //the whole response has been recieved, so we just print it out here
            response.on('end', function () {
                //TODO: Validate that this is a valid ALPS document.
                console.log(str);
                res.send(200, str);
            });
        });
        
        console.log('blah');
        
        req.on('error', function(e) {
            console.log('problem with request: ' + e.message);
            res.send(400, 'error.');
        });
        
        req.end();
    }        
});

// PROJECTS

// Retrieve a list of authorized projects for this user
//app.get('/projects', passport.authenticate('bearer', {session: false}), function(req, res) {
app.get('/projects', function(req, res) {
//conn.collection('projects').find({owner: req.user}).toArray(function( err, projects ) {
conn.collection('projects').find().toArray(function( err, projects ) {
		if( err ) {
			res.status(500);
			res.send('{"message" : "Unable to get projects"}');
			console.log(err);
		}else {
			res.send(projects);
		}
		
	});
});
app.get('/projects/:projectId', passport.authenticate('bearer', {session: false}), authorizeUser, function(req, res) {
//	app.get('/projects', function(req, res) {
	
	console.log('req.user:');
	console.log(req.user);
    console.log(req.params.projectId);
        
	
    if( req.params.projectId == null ) {
        res.send(400, '{"message": "invalid project id"}');
	
    } else {
        conn.collection('projects').find({owner: req.user, _id: conn.ObjectID.createFromHexString(req.params.projectId) }).toArray(function( err, projects ) {
		if( err ) {
			res.status(500);
			res.send('{"message" : "Unable to get project."}');
			console.log(err);
		}else {
			res.send(projects);
		}		
	});
        
    }
	
});

// Create a new project
app.post('/projects', passport.authenticate('bearer', {session: false}), function(req, res) {
	var name = req.body.name;
	var description = req.body.description;
	var hostname = req.body.hostname;
    var contentType = req.body.contentType;
	var projectType = req.body.projectType;
	
	//TODO: Add owner and creation stamp details
	
	var project = {
			name : name,
			description : description,
			hostname : hostname,
			projectType: projectType,
            contentType: contentType,
			owner : req.user,
			created : new Date()
	}
			
	conn.collection('projects').insert(project, function (err, post) {
		if( err === null ) {
			//TODO: Check if this is a hypermedia project
			// If this is a hypermedia project, create the first home resource automatically				
			var home = {
				title: 'home',
				description: 'the default starting point',
				project: post[0]._id.toString()
			}
			conn.collection('tasks').insert(home, function (err, post) {
			});
			res.send(200, post);
		}else {
			console.log(err);
			res.send(500);
		}
	});
});


// Update the simple vocabulary of a project
app.put('/projects/:projectId/vocabulary', function(req, res) {	
	var projectId = req.params.projectId;
	// get vocab list from JSON body
	var vocabulary = req.body.vocabulary;
	
	conn.collection('projects').update(
		{_id: conn.ObjectID.createFromHexString(projectId)}, 
		{'$set': {'simpleVocabulary': vocabulary}},
		function(err, post) {
			if( !err ) {
				res.send(200);
			} else {
				res.send(500, err);
			}
	});
    	
});

// Delete a project
app.delete('/projects/:projectId', passport.authenticate('bearer', {session: false}), authorizeUser, function(req, res) {
	var projectId = req.params.projectId;
	
	//TODO: implement this.
	// Remove the resources/states/nodes/tasks whatever we are calling them now
	
	
});


app.post('/project/:projectId/engine/start',  passport.authenticate('bearer', {session: false}), authorizeUser, function(req, res) {
	var projectId = req.params.projectId;    
    // update the hostname
    
    // register listeners
	registerMockListeners();
});

app.post('/project/:projectId/engine/stop', passport.authenticate('bearer', {session: false}), authorizeUser, function(req, res) {
	var projectId = req.params.projectId;    
    // remove listeners
});

var mockListeners = {};

// setup the backend API based on the state and transitions that have been defined
function registerMockListeners() {
	
	//TODO: this won't scale the way it is currently written.  It is loading all resources into memory, instead it should only 
	// register active projects.
	
	console.log('loading listeners');
	mockListeners = {};
	
	conn.collection('projects').find().toArray(function( err, projects ) {
		
		// create an object to store project data by ID key
		var projectMap = {};			
		for( projectIndex in projects ) {
			var project = projects[projectIndex];
			projectMap[project._id] = project;
			console.log(projectMap);
		}
		
		// Register listeners for the resources.  These are anonymous access listeners ideal for CRUD style APIs	
		conn.collection('resources').find().toArray(function (err, resources) {
			for( resourceIndex in resources ) {				
				var resource = resources[resourceIndex];
				if( resource.url && resource.methods && resource.methods.length > 0) {
					var key = project.hostname + "." + resource.url;
					mockListeners[key] = {
								title : resource.name,
								responses : resource.responses,			
								methods : resource.methods,
								contentType : 'application/json'
						}
				}				
			}
			console.log('resource mockListeners:');
			console.log(mockListeners);
		});
				
		
		/**
		conn.collection('tasks').find().toArray(function (err, tasks) {
			
			// Maintian a list of response hashes so we can use these for transitions later on.
			var responseMap = {};						
			
			for( taskIndex in tasks) {						
				var task = tasks[taskIndex];
				console.log(task._id);
				var projectId = task.project;
				var project = projectMap[projectId];	
				//console.log('project: ' + project);
				responseMap[task._id] = task.responseData;
				
				if( task.url != null && task.url != "" && project != undefined ) {
					var key = project.hostname + "." + task.url;
					//console.log(key);
					mockListeners[key] = {
							title : task.title,
							response : task.responseData,			
							methods : task.methods
					}
					
				}
			}
			
			
			console.log('****RESPONSE MAP****');
			console.log(responseMap);
			// Register listeners for transitions.  These are ideal for hypermedia style APIs
			conn.collection('transitions').find().toArray(function (err, transitions) {
				for( transitionsIndex in transitions ) {
					var transition = transitions[transitionsIndex];
					var projectId = transition.project;
					var project = projectMap[projectId];
					
					if( transition.url != "" && project != undefined ) {
						//todo: what if the key is not unique?
						var key = project.hostname + "." + transition.url;
						console.log(transition);
						console.log('target: %s', transition.target);
						var response = responseMap[transition.target];
						console.log(response);
						mockListeners[key] = {
								title : transition.title,
								response : response,			
								methods : [transition.method]
						}
					}					
				}
			});  //conn.collection('transitions')
		

		}); //conn.collection('tasks')**/
				
	});  //conn.collection('projects')	
	
	
	
}

// use our mock listeners to handle any remaining requests 
app.all('*', function(req, res) {

	console.log('in listener handler.');
	var subdomain = req.host.split(".")[0];
	console.log(subdomain);
	
	var listenerKey = subdomain + "." + req.path;
	console.log(listenerKey);
	
    console.log(Object.keys(mockListeners));
    
	if( mockListeners[listenerKey] != null) {				
		var listener = mockListeners[listenerKey];
		
		console.log(listener);
		
		if( listener.methods.indexOf(req.method) < 0 ) {		
			// TODO: Allow the user to customize the error message and headers
			res.status(405);
			res.set('Allow',listener.methods);
			res.send("this method is not supported.");
		}else {
			// TODO: write response headers
			// For the demo we will hardcode an app/json+hal header
			res.set('Content-Type', listener.contentType);									
			
			// Find the appropriate response
			for( var i =0; i < listener.responses.length; i++ ) {
				
				var response = listener.responses[i];				
				
				console.log(req.method);
				if( response.name === req.method ) {
					res.send(response.body);	
				}
			}
			
		}		
	}else {
		res.status(404);
		res.send('no listener found.');
	}
		
	
});

function formatCollection(collection, callback) {
	//console.log(collection);
	// for now I'm not doing anything - in the future I may format this appropriately
	var formattedResponse = collection;
	var err = null;
	callback(err, formattedResponse);
}

registerMockListeners();

var port = process.env.PORT || 8081;
app.listen(port);
console.log('Express server started on port %s', port);
