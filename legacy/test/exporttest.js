var db = require('../src/db/mongo.js');
db.init();

db.findAll('projects', {}, function(err, result) {
    console.log(err);
    console.log(result);
});
