var mongo = require('mongoskin');
var passport = require('passport');

module.exports = function(app, conn){
	
	app.get('/projects/:projectId/maps', function(req,res) {
		
		var projectId = req.params.projectId;
    		    
		if( projectId == null ) {
			res.send(400, '{"message": "invalid project ID"}');
		}

		conn.collection('maps').find({project: projectId}).toArray(function (err, maps) {
			res.send(maps);
			//TODO: Include response data
		});
	});
	
	app.post('/projects/:projectId/maps', function(req,res) {
				
		var _map = req.body.map;
		
		var map = {
			name: _map.name,
			description: _map.description,
			image: _map.image,
			steps: _map.steps,
			project: req.params.projectId
			
		}
								
		conn.collection('maps').insert(map, function (err, insertResult) {
			if( err ) res.send(500, err);
			else res.send(insertResult);
		});
		
	});
	
	app.put('/projects/:projectId/maps/:mapId', function(req,res) {
		var _map = req.body.map;
		var id = req.params.mapId;
						
		var map = {
			name: _map.name,
			description: _map.description,
			steps: _map.steps,
			project: req.params.projectId
		}
		
		conn.collection('maps').updateById(mongo.helper.toObjectID(id), map, function (err, result) {
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
