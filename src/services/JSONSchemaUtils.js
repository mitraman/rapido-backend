"use strict";

const winston = require('winston');
const Promise = require('bluebird');

let JSONSchemaUtils = function() {

}

// Converts a json object into a JSON Schema using dynamic typing
JSONSchemaUtils.prototype.generateSchema = function(json) {
  winston.log('debug', '[JSONSchemaUtils] generating schema for: ', json);
  let schema = {};
  if( typeof json === 'object') {
    if( Array.isArray(json)) {
      winston.log('debug', '[JSONSchemaUtils] generateSchema - this is an array');
      schema.type = 'array';
      let items = [];
      json.forEach(item => {
        items.push(this.generateSchema(item));
      })

      // If the items are all of the same type, they can be merged into a single type
      let lastType;
      let lastProps = {};
      let identicalTypes = true;

      for( let i = 0; i < items.length && identicalTypes === true; i++ ) {
        if( items[i].type === 'object' ) {
          // Don't bother, it gets too complicated.  Maybe in the future we can merge identical nested objects
          identicalTypes = false;
        }else if(!lastType) {
          lastType = items[i].type;
        }else if( items[i].type != lastType ) {
          identicalTypes = false
        }else {
          lastType = items[i].type
        }
      }

      if( identicalTypes ) {
        schema.items = items[0];
      }else {
        schema.items = items;
      }

    }else {
      winston.log('debug', '[JSONSchemaUtils] generateSchema - this is an object');
      schema.type = 'object';
      let properties = {};
      Object.keys(json).forEach(property => {
        properties[property] = this.generateSchema(json[property]);
      })
      if( Object.keys(properties).length > 0) {
        schema.properties = properties;
      }
    }
  }else {
    winston.log('debug', '[JSONSchemaUtils] generateSchema - this is a primitive type:',typeof json);
    schema.type = typeof json;
  }
  return schema;
}

module.exports = new JSONSchemaUtils();
