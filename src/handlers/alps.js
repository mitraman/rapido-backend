var mongo = require('mongoskin');
var passport = require('passport');
var alps = require('../alps/alps.js');

module.exports = function(app, conn, authorizeUser){

app.get('/alps', passport.authenticate('bearer', {session: false}), function(req, res) {
    conn.collection('alps').find({owner: req.user}).toArray(function( err, alps ) {
		if( err ) {
			res.status(500);
			res.send('{"message" : "Unable to get alps models"}');
			console.log(err);
		}else {
			res.send(alps);
		}
	});
});


app.get('/alps/:alpsId', passport.authenticate('bearer', {session: false}), authorizeUser, function(req, res) {
    if( req.params.alpsId === null ) {
        res.send(400, '{"message": "Invalid ALPS id"}');
    } else {
        conn.collection('alps').find({owner: req.user, _id: mongo.helper.toObjectID(req.params.alpsId) }).toArray(function( err, alps ) {
            if( err ) {
                res.send(500, '{"message" : "Unable to get ALPs document"}');
            }else {
                res.send(alps);
            }
        });
    }
});

app.post('/alps', passport.authenticate('bearer', {session: false}), function(req, res) {
	var name = req.body.alps.name;
	var description = req.body.alps.description;
    var contentType = req.body.alps.contentType;
    var source = req.body.alps.source;
    var json = req.body.alps.json

    alps(contentType, source, function(err, parsed) {
        if( err ) {
            res.send(400, 'unable to parse alps document');
        }else {
            var alpsProfile = {
                    name : name,
                    description : description,
                    contentType: contentType,
                    source: source,
                    json: parsed,
                    owner : req.user,
                    created : new Date()
            };


            conn.collection('alps').insert(alpsProfile, function (err, post) {
                if( !err ) {
                    res.send(201, post);
                }else {
                    console.log(err);
                    res.send(500,err);
                }
            });
        }
    });
});

}
