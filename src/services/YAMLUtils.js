"use strict";

const winston = require('winston');
const Promise = require('bluebird');

let YAMLUtils = function() {

}

YAMLUtils.prototype.objectToYaml = function(format, jsonObject, depth, sequenceItem) {
  winston.log('debug', '[YAMLUtils] objectToYaml called with: ', jsonObject);
  let yamlDoc = '';
  if( !depth ) {
    depth = 0;
  }

  Object.keys(jsonObject).forEach((key, index) => {
    winston.log('debug', '[YAMLUtils] objectToYaml processing key: ', key);
    let indent = '';


    for( let i = 0; i < depth; i++ ) {
      indent += '  ';
    }

    if( sequenceItem ) {
        if( index === 0 ) {
          indent += '- ';
        }else {
          indent += '  ';
        }
    }

    let jsonVal = jsonObject[key];
    // the swagger property is a special case - in YAML it has to be a quoted string value
    if(format === 'oai2' && key === 'swagger') {
      yamlDoc += indent + key + ': "' + jsonVal + '"\n';
    }else if( format === 'oai2' && key === 'application/json') {
        // Just dump the JSON object directly for OAS2
        yamlDoc += indent + key + ': ' + JSON.stringify(jsonVal) + '\n';
    }else if( typeof jsonVal === 'object' ) {
      if( Array.isArray(jsonVal)) {
        winston.log('debug', '[YAMLUtils] ' + key + ' is an array');
        // Write the values as a hyphenated list
        // Only conver the array if it has values
        if( jsonVal.length > 0 ) {
          yamlDoc += indent + key + ':\n';
          jsonVal.forEach(item => {
            if( typeof item === 'object' ) {
              yamlDoc += this.objectToYaml(format, item, depth+1, true);
            }else {
              yamlDoc += indent + '  - ' + item + '\n';
            }
          })
        }
      } else {
        winston.log('debug', '[YAMLUtils] ' + key + ' is an object');
        yamlDoc += indent + key + ':\n';
        if( sequenceItem ) {
          yamlDoc += this.objectToYaml( format, jsonVal, depth+2 );
        }else {
          yamlDoc += this.objectToYaml( format, jsonVal, depth+1 );
        }

      }
    }else {
      yamlDoc += indent + key +  ': ' + jsonVal + '\n';
    }
  })
  return yamlDoc;
}

module.exports = new YAMLUtils();
