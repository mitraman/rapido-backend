"use strict";

const winston = require('winston');
const Promise = require('bluebird');
const NodeCache = require( "node-cache" );


/**
* A Promise wrapper for NodeCache
*/
var Cache = function (options) {
  winston.log('warn', '[Cache] options are not used in the Cache constructor')
  Cache._cache = new NodeCache({useClones: false});
};

Cache.prototype.flushAll = function() {
  return Cache._cache.flushAll();
}

Cache.prototype.keys = function() {
  return Cache._cache.keys();
}

Cache.prototype.get = function(key) {
  return new Promise( (resolve,reject) => {
    Cache._cache.get(key, (err, value) => {
      if( err ) {
        reject(err);
      } else {
        resolve(value);
      }
    });
  })
}

Cache.prototype.set = function(key, value, ttl) {
  return new Promise( (resolve, reject) => {
    Cache._cache.set(key, value, ttl, (err, success) => {
      if( err ) {
        reject(err);
      } else {
        resolve(success);
      }
    })
  })
}

Cache.prototype.ttl = function(key, ttl) {
  return new Promise( (resolve, reject) => {
    Cache._cache.ttl(key, value, (err, changed) => {
      if( err ) {
        reject(err);
      } else {
        resolve(changed);
      }
    })
  })
}

Cache.prototype.on = function(eventName, listener) {
  return Cache._cache.on(eventName, listener);
}

Cache.prototype._nodecache = function() {
  return Cache._cache;
}

module.exports = Cache;
