var mongo = require('mongoskin');
var passport = require('passport');
var representer = require('../representers/json.js')();

exports.createSketch = function(name, description, projectId, callback) {
    callback(null, 'this one works');
}

module.exports = function(app, conn){

app.post('/projects/:projectId/sketches', passport.authenticate('bearer', {session: false}), function(req, res) {

    var _sketch = req.body.sketch;

    if( !_sketch ) {
        res.send(400, representer.errorMessage('No sketch object provided in request body.') );
        return;
    }
    
    var sketch = {
        name: _sketch.name,
        description: _sketch.description,
        responses: [],
        thumbnail: '',
        project: req.params.projectId,
        owner: req.user,
        created: new Date()
    }

    conn.insert('sketches', sketch, function(err, id, newSketch) {
        if( err ) {
            res.send(500, representer.errorMessage('Unable to create sketch object'));
        }else {
            res.send(201, newSketch);
        }
    });
});

app.get('/projects/:projectId/sketches', passport.authenticate('bearer', {session: false}), function(req, res) {

    var projectId = req.params.projectId;

    conn.findAll('sketches', {project: projectId, owner: req.user}, function (err, sketches) {
        if( err ) {
            res.send(500, representer.errorMessage('unable to retrieve sketches'));
        }else {
            res.send(sketches);
        }
	});
});

app.get('/sketches/:sketchId', passport.authenticate('bearer', {session: false}), function(req, res) {

    var sketchId = req.params.sketchId;

    conn.findOne('sketches', {id: sketchId, owner: req.user}, function( err, sketch) {
        if( err ) { 
            res.send(representer.errorMessage('Unable to retrieve sketch'));
        } else if( !sketch ) {
           res.send(404, representer.errorMessage('No sketch found'));
        } else {
            res.send(200, sketch);
        }
    });
});

app.delete('/sketches/:sketchId', passport.authenticate('bearer', {session: false}), function(req, res) {
    res.send(500, 'not implemented yet');
});

app.put('/sketches/:sketchId', passport.authenticate('bearer', {session: false}), function(req, res) {
    res.send(500, 'not implemented yet');
});

}
