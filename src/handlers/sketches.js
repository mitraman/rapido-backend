var mongo = require('mongoskin');
var passport = require('passport');

module.exports = function(app, conn, authorizeUser){

app.post('/project/:projectId/sketches', passport.authenticate('bearer', {session: false}), function(req, res) {

    if( !req.params.projectId ) { 
        res.send(400, 'project id must be specified' );
    }
    var _sketch = req.body.sketch;

    console.log(_sketch);

    var sketch = {
        name: _sketch.name,
        description: _sketch.description,
        responses: [],
        thumbnail: '',
        project: req.params.projectId,
        owner: req.user
    }

    conn.collection('sketches').insert(sketch, function(err, insertResult) {
        if( err ) { 
            res.send(500, err);
        }
        res.send(200, insertResult);
    });
});

app.get('/projects/:projectId/sketches', passport.authenticate('bearer', {session: false}), function(req, res) {

    var projectId = req.params.projectId;

    conn.collection('sketches').find({project: projectId, owner: req.user}).toArray(function (err, sketches) {
        //TODO: Use abstraction to convert the database model into a JSON message
        if( err ) {
            res.status(500);
        }else {
            res.send(sketches);
        }
	});
});

}
