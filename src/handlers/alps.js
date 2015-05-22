var mongo = require('mongoskin');
var passport = require('passport');
var alps = require('../alps/alps.js');
var representer = require('../representers/json.js')();

module.exports = function(app, conn, authorizeUser){

app.get('/alps', passport.authenticate('bearer', {session: false}), function(req, res) {
    
    conn.findAll('alps', {owner: req.user}, function(err, alps) {
       if( err ) {
           res.send(500, representer.errorMessage('Unable to retrieve ALPS profiles'));
           return;
       } 
       res.send(200, alps);
    });
});


app.get('/alps/:alpsId', passport.authenticate('bearer', {session: false}), function(req, res) {
    
    conn.findOne('alps', {owner: req.user, id: req.params.alpsId }, function(err, alpsProfile ) {
        if( !project ) {
            res.send(404, representer.errorMessage('alps profile not found'));
            return;
        }
        res.send(200, alpsProfile);
    });
});

app.post('/alps', passport.authenticate('bearer', {session: false}), function(req, res) {
	var name = req.body.alps.name;
	var description = req.body.alps.description;
    var contentType = req.body.alps.contentType;
    var source = req.body.alps.source;
    var json = req.body.alps.json

    if( !name ) {
        res.send(400, representer.errorMessage('ALPS name is a required field'));
    }

    alps(contentType, source, function(err, parsed) {
        if( err ) {
            res.send(400, 'unable to parse alps document');
            return;
        }
        var alpsProfile = {
                name : name,
                description : description,
                contentType: contentType,
                source: source,
                json: parsed,
                owner : req.user,
                created : new Date()
        };

        conn.insert('alps', alpsProfile, function(err, newProfile) {
            if( err ) {
                res.send(500, representer.errorMessage('Unable to create ALPS profile'));
                return;
            }
            res.send(201, newProfile);
        });
    });
});

}
