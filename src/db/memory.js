// A simple in memory db for testing

var conn;

function parseFilter(filter) {

    if( !filter ) {
        return {};
    }
    var _filter = {};

    for( var prop in filter ) {
        if( prop === 'id' ) {
            _filter._id = mongo.helper.toObjectID(filter.id);
        }else {
            _filter[prop] = filter[prop];
        }
    }
    return _filter;
}

exports.init = function() {
    var connUrlString = '';
    if( process.env.MONGO_USERNAME && process.env.MONGO_PASSWORD ) {
        connUrlString = process.env.MONGO_USERNAME + ":" + process.env.MONGO_PASSWORD + "@" + process.env.MONGO_URL;
    }else {
        connUrlString = process.env.MONGO_URL;
    }
    conn = mongo.db(connUrlString, {auto_reconnect: true});
    return conn;
}

exports.findAll = function(resourceType, filter, callback) {
    if( !conn ) { callback( 'this database connector must be initialized first.'); return; }

    conn.collection(resourceType).find(parseFilter(filter)).toArray(function( err, result ) {
       callback(err, result);
    });
}

exports.findOne = function(resourceType, filter, callback) {
    if( !conn ) { callback( 'this database connector must be initialized first.'); return; }

    conn.collection(resourceType).find(parseFilter(filter)).toArray(function( err, result ) {
       if( err || !result) {
           callback(err);
           return;
       }
       if( result.length === 0 ) {
           callback(err, null);
       }else {
           callback(err, result[0]);
       }
    });
}

exports.insert = function(resourceType,resource, callback) {
    if( !conn ) { callback( 'this database connector must be initialized first.'); return; }
    conn.collection(resourceType).insert(resource, function(err, newResource) {
        if( err || !newResource ) {
            callback(err);
            return;
        }
        callback(err, newResource[0]._id.toString(), newResource[0]);
    });
}
