// Hypermedia State API
// TODO: Add authentication and register mock listeners on changes

var mongo = require('mongoskin');

module.exports = function(app, conn){

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

        if( !state.transitions ) { state.transitions = []; }
        if( !state.responses ) { state.responses = []; }
        state.url = '$(' + state.name + ')';
	
		conn.collection('states').insert(state, function (err, insertResult) {
			if( err ) {
				res.send(500, err);
			} else {				
				// Update the state parent's children property
				console.log(insertResult[0]);
				if( insertResult[0].parent ) {
					var parentId = conn.ObjectID.createFromHexString(insertResult[0].parent);
					var stateId = insertResult[0]._id.toString();
					conn.collection('states').update(
						{_id: parentId },
						{'$push': { children: stateId} },
						function (err, result) {
						if( err ) {
							// We aren't using commits so just fail if this happens.  Not great, but no time to deal with this for now.
							console.log('warn...');
							console.warn('Unable to update parent state');
							res.send(insertResult);
						} else {			
							res.send(insertResult);
						}
					});
				} else {
					res.send(insertResult);
				}
				
			}
		});
				
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
	
	//TODO: I ran out of time trying to get atomic response manipulation working.  I'll just deal with it at the states level instead.
	
	
	/**
	// Create a new response for a particular state
	app.post('/projects/:projectId/states/:stateId/responses', function(req,res) {
		var projectId = req.params.projectId;
		var stateId = req.params.stateId;

		var _response = req.body.response;

		var response = {
			name: "",
			status: "200",
			headers: {},
			conditions : _response.conditions,
			body: _response.body,
			state: stateId,
			project: projectId
		}
		
		console.log(response);
		
		
		conn.collection('responses').insert(response, function (err, result) {
			if( err ) {
				res.send(500, err);
			}else {
				res.send(result);
			}
		})
	});
	**/
	
	/*
	// Upsert a response 
	app.put('/projects/:projectId/states/:stateId/responses/:name', function(req,res) {
		var projectId = req.params.projectId;
		var stateId = req.params.stateId;
		var responseName = req.params.name;
		
		//db.states.update({_id: ObjectId("54426195293ae6d92f000002")}, {$set: { "responses.second": {'name': 'second'} } } )
		
		//TODO: This is a security problem.  We should blacklist this field.
		var responseSelector = "responses." + responseName;
		
		conn.collection('states').updateById(conn.ObjectID.createFromHexString(stateId), 
												{$set: { 'responses.' + responseName: {'name': responseName} } },
												function (err, result) {
													if(err) res.send(500,err);
													else res.send(result);
												});
	});
			
		
	// Delete an existing response
	app.delete('/projects/:projectId/states/:stateId/responses/:name', function(req,res) {
	});
		
		*/
}

