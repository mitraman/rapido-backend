var mongo = require('mongoskin');
var passport = require('passport');
var representer = require('../representers/json.js')();

module.exports = function(app, conn) { 

app.get('/sketches/:sketchId/hypernodes', passport.authenticate('bearer', {session: false}), function(req, res) {
    conn.findAll('responses', {owner: req.user}, function(err, responses) {
       if( err ) {
           res.send(500, representer.errorMessage(err));
           return;
       } 
       res.send(200, responses);
    });
});

app.post('/sketches/:sketchId/hypernodes', passport.authenticate('bearer', {session: false}), function(req, res) {

    var node = req.body.node;

    var url = node.url; 
    var method = node.method;
    var description = node.description;
    var contentType = node.contentType;
    var body = node.body;

    var node = {
        url: url,
        description: description,
        contentType: contentType,
        created: new Date(),
        method: method,
    }

    conn.insert('hypernodes', node, function(err, id, newHyperNode) {
        if( err ) {
            res.send(500, representer.errorMessage('unable to create hypermedia node'));
        }else {
            res.send(201, newHyperNode);
        }
    });


});

}
