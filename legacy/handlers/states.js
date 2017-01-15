// Hypermedia State API
// TODO: Add authentication and register mock listeners on changes

var mongo = require('mongoskin');

module.exports = function(app, conn){

	// Retrieve a specific version of a state diagram
	app.get('/projects/:projectId/states/:version', function(req, res) {
		var projectId = req.params.projectId;
		var version = req.params.version;

		if( projectId == null ) {
			res.send(400, '{"message": "invalid project ID"}');
		}

		conn.collection('states').find({project: projectId,version:version}).toArray(function (err, states) {
			res.send(states);
		});
	})

	// Retrieve list of states
    app.get('/projects/:projectId/states', function(req, res){
		
		var projectId = req.params.projectId;
    		    
		if( projectId == null ) {
			res.send(400, '{"message": "invalid project ID"}');
		}

		conn.collection('states').find({project: projectId}).toArray(function (err, states) {
			res.send(states);
		});
	 });
	
	// Create a new state
	app.post('/projects/:projectId/states', function(req,res) {
				
		// Store a newly created task object		
		var _state = req.body.state;
		
		var state = {
			name: _state.name,
			description: _state.description,
			responses: _state.responses,
            transitions: _state.transitions,
			project: req.params.projectId
		}

        console.log(req.params.projectId);
        console.log(mongo.helper.toObjectID(req.params.projectId));

        if( !state.transitions ) { state.transitions = []; }
        state.url = '$(' + state.name + ')';

        if( !state.responses || state.responses.primary.length === 0 ) {
            // Create a default response body depending on the contentType
            // Get the project
            console.log('creating default response');
            conn.collection('projects').find({_id: mongo.helper.toObjectID(req.params.projectId)}).toArray(function( err, projects ) {
                if( err ) {
                    res.send(500, err);
                } else {
                    if( projects.length === 0 ) { 
                        res.send(500, 'unable to find parent project');
                    } else {
                        var contentType = projects[0].contentType;

                        if( !state.responses ) {
                            state.responses = {};
                        }

                        if( contentType === 'application/vnd.collection+json' ) {
                            state.responses.primary = '{\n"collection": {},\n "version": "1.0"}';
                        }else {
                            state.responses.primary = '{}';
                        }

                        createState(state);
                    }
                }
            });    
        } else {
            createState(state);
        }

        function createState(state) {
            conn.collection('states').insert(state, function (err, insertResult) {
                if( err ) {
                    res.send(500, err);
                } else {				
                    // Update the state parent's children property
                    res.send(insertResult);
                }
            });
        }
				
		//registerMockListeners();
	});
	
	// Replace an existing state
	app.put('/projects/:projectId/states/:stateId', function(req,res) {
		// Store a newly created task object		
		var _state = req.body.state;
		var id = req.params.stateId;

        console.log(_state);
						
		var state = {
			name: _state.name,
			description: _state.description,
			responses: _state.responses,
            transitions: _state.transitions,
            x: _state.x,
            y: _state.y,
			project: req.params.projectId

		}
        if( !state.transitions ) { state.transitions = []; }
        if( !state.responses ) { state.responses = []; }
        state.url = '$(' + state.name + ')';
		
		conn.collection('states').updateById(mongo.helper.toObjectID(id), state, function (err, result) {
			if( err ) {
				res.status(500);
				res.send('{"message" : "Unable to store data in database."}');
				console.log(err);
			}else {						
				res.send(200, result);
			}        	        
    	});		
	});

	app.delete('/projects/:projectId/states/:stateId', function(req,res) {
		var id = req.params.stateId;
		
		conn.collection('states').removeById(conn.ObjectID.createFromHexString(id), function (err, result) {
			if( err ) {
				res.status(500);
				res.send('{"message" : "Unable to store data in database."}');
				console.log(err);
			}else {						
				res.send(200, result);
			}        	        
		});
	});
	
}

