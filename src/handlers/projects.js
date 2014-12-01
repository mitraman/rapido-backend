var mongo = require('mongoskin');
var passport = require('passport');

module.exports = function(app, conn, authorizeUser){

// Retrieve a list of authorized projects for this user
app.get('/projects', passport.authenticate('bearer', {session: false}), function(req, res) {
    conn.collection('projects').find({owner: req.user}).toArray(function( err, projects ) {
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
	
    if( req.params.projectId == null ) {
        res.send(400, '{"message": "invalid project id"}');
    } else {
        conn.collection('projects').find({owner: req.user, _id: mongo.helper.toObjectID(req.params.projectId) }).toArray(function( err, projects ) {
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
            templates: req.body.templates,
			owner : req.user,
			created : new Date()
	}

    project.simpleVocabulary = [];

    console.log(project);
			
	conn.collection('projects').insert(project, function (err, post) {
		if( err === null ) {
			//TODO: Check if this is a hypermedia project
			// If this is a hypermedia project, create the first home resource automatically				

            if( post[0].projectType === 'hypermedia' ) {
                var home = {
                    name: 'home',
                    description: 'The default start state.',
                    transitions: [],
                    responses: {primary: '{}'},
                    uri: '$(home)',
                    project: post[0]._id.toString()
                };

                if( post[0].contentType === 'application/vnd.collection+json' ) {
                    var doc = {};
                    doc.collection = {};
                    doc.version = '1.0';
                    home.responses.primary = JSON.stringify(doc, null, '    ');
                }
                conn.collection('states').insert(home, function (err, post) {
                });
            }
			res.send(200, post);
		}else {
			console.log(err);
			res.send(500);
		}
	});
});


app.put('/projects/:projectId', function(req,res) {
    var projectId = req.params.projectId;

    // Do partial replace by default.
    // TODO: support other attributes
    var vocabulary = req.body.simpleVocabulary;
    var name = req.body.name;
    var description = req.body.description;
    var projectType = req.body.projectType;
    var contentType = req.body.contentType;
    var templates = req.body.templates;

    console.log(name);
    console.log(req.body);

    var updatedContent = {};
    if( vocabulary ) { updatedContent.simpleVocabulary = vocabulary; }
    if( name ) { updatedContent.name = name; }
    if( description ) { updatedContent.description = description; }
    if( projectType ) { updatedContent.projectType = projectType; }
    if( contentType ) { updatedContent.contentType = contentType; }
    if( templates ) { updatedContent.templates = templates; }
    console.log(updatedContent);

	conn.collection('projects').update(
		{_id: mongo.helper.toObjectID(projectId)}, 
		{'$set': updatedContent },
		function(err, post) {
			if( !err ) {
				res.send(200);
			} else {
				res.send(500, err);
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

}
