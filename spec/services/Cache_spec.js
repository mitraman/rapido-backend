"use strict";

const winston = require('winston');
const Promise = require('bluebird');
const Cache = require('../../src/services/Cache.js');


describe('Cache', function() {

  let cache = new Cache();

  describe('storage functions', function() {

    afterAll( function() {
      // Cleaning up after playing with the cache
      cache.flushAll();
    });

    beforeEach( function() {
      jasmine.clock().install();
    })

    afterEach(function() {
      jasmine.clock().uninstall();
    })

    it('should return a null value when an uncached key is requested', function(done) {
      let sketchId = 1;
      cache.get(sketchId)
      .then( (tree) => {
        expect(tree).toBeUndefined();
        done();
      }).catch( (error) => {
        fail(error);
      })
    })

    it('should store and return a value', function(done) {
      let sketchId = 2;
      let tree = {
        children: [
          { id: '1' },
          { id: '2' }
        ]
      }
      cache.set(sketchId, tree)
      .then( () => {
        return cache.get(sketchId)
      }).then( result => {
        expect(result).toEqual(tree);
        done();
      }).catch( error => {
        fail(error);
      })
    })

/**
* Spec has changed: the cache doesn't honour options anymore.

    it('should return a clone of a stored object', function(done) {

      let refCache = new Cache({useClones: true});
      let key = 'reference-test';

      let originalObject = {
        value: 'original'
      }

      refCache.set(key, originalObject)
      .then( () => {
        return refCache.get(key)
      }).then( val => {
        val.value = 'updated';
        expect(originalObject.value).toBe('original');
      }).catch(e => fail(e)).finally(done);
    })

    it('should store and return objects by reference', function(done) {

      let refCache = new Cache({useClones: false});
      let key = 'reference-test';

      let originalObject = {
        value: 'original'
      }

      refCache.set(key, originalObject)
      .then( () => {
        return refCache.get(key)
      }).then( val => {
        val.value = 'updated';
        expect(originalObject.value).toBe('updated');
      }).catch(e => fail(e)).finally(done);
    })
    **/

  });

});
