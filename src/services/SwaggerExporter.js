"use strict";

const winston = require('winston');
const Promise = require('bluebird');

/**
* Export functions for OpenAPISpec
*/
var SwaggerExporter = function () {
};


// Converts a json thing into a JSON Schema using dynamic typing
let generateSchema = function(json) {
  winston.log('debug', '[SwaggerExporter] generating schema for: ', json);
  let schema = {};
  if( typeof json === 'object') {
    if( Array.isArray(json)) {
      winston.log('debug', '[SwaggerExporter] generateSchema - this is an array');
      schema.type = 'array';
      let items = [];
      json.forEach(item => {
        items.push(generateSchema(item));
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
      winston.log('debug', '[SwaggerExporter] generateSchema - this is an object');
      schema.type = 'object';
      let properties = {};
      Object.keys(json).forEach(property => {
        properties[property] = generateSchema(json[property]);
      })
      if( Object.keys(properties).length > 0) {
        schema.properties = properties;
      }
    }
  }else {
    winston.log('debug', '[SwaggerExporter] generateSchema - this is a primitive type:',typeof json);
    schema.type = typeof json;
  }
  return schema;
}

let objectToYaml = function(jsonObject, depth, sequenceItem) {
  winston.log('debug', '[SwaggerExporter] objectToYaml called with: ', jsonObject);
  let yamlDoc = '';
  if( !depth ) {
    depth = 0;
  }

  Object.keys(jsonObject).forEach((key, index) => {
    winston.log('debug', '[SwaggerExporter] objectToYaml processing key: ', key);
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
    if(key === 'swagger') {
      yamlDoc += indent + key + ': "' + jsonVal + '"\n';
    }else if( key === 'application/json') {
        // Just dump the JSON object directly
        yamlDoc += indent + key + ': ' + JSON.stringify(jsonVal) + '\n';
    }else if( typeof jsonVal === 'object' ) {
      if( Array.isArray(jsonVal)) {
        winston.log('debug', '[SwaggerExporter] ' + key + ' is an array');
        // Write the values as a hyphenated list
        // Only conver the array if it has values
        if( jsonVal.length > 0 ) {
          yamlDoc += indent + key + ':\n';
          jsonVal.forEach(item => {
            if( typeof item === 'object' ) {
              yamlDoc += objectToYaml(item, depth+1, true);
            }else {
              yamlDoc += indent + '  - ' + item + '\n';
            }
          })
        }
      } else {
        winston.log('debug', '[SwaggerExporter] ' + key + ' is an object');
        yamlDoc += indent + key + ':\n';
        if( sequenceItem ) {
          yamlDoc += objectToYaml( jsonVal, depth+2 );
        }else {
          yamlDoc += objectToYaml( jsonVal, depth+1 );
        }

      }
    }else {
      yamlDoc += indent + key +  ': ' + jsonVal + '\n';
    }
  })
  return yamlDoc;
}

let extractPathParameters = function(node) {
  let path = node.fullpath;
  let parameterizedPath = '';
  let pathParameterObjects = [];

  while(path.indexOf('/:') >= 0 || path.indexOf('/{') >= 0 ) {

    winston.log('debug', '[SwaggerExporter] this path contains parameters: ', path);

    let segment;
    let parameter = {
      name: '',
      in: 'path',
      type: 'string',
      required: true,
    };

    // Determine which token to process (/: or /{})
    let startIndex = path.indexOf('/:');
    let curlyStartIndex = path.indexOf('/{');
    let processedCurly = false;

    if( curlyStartIndex >= 0 && (curlyStartIndex < startIndex || startIndex < 0) ) {
      // Make sure there is an end brace
      let curlyEndIndex = path.indexOf('}', curlyStartIndex);
      if(curlyEndIndex >= 0) {
        //console.log('curlyEndIndex:', curlyEndIndex);
        // Make sure the end brace occurs before the next path segment
        let nextPathSeparator = path.indexOf('/', curlyStartIndex+2);
        //console.log('nextPathSeparator:', nextPathSeparator);
        if( nextPathSeparator >= 0 && nextPathSeparator > curlyEndIndex ) {
          winston.log('debug', 'processing curly brace segment ');
          processedCurly = true;
          // Store the path segment and continue processing
          segment = path.slice(curlyStartIndex, curlyEndIndex);
          parameter.name = segment.slice(2);
          pathParameterObjects.push(parameter);

          parameterizedPath += path.slice(0, curlyEndIndex+1);
          winston.log('debug', 'parametrizedPath is ', parameterizedPath);
          path = path.slice(curlyEndIndex+1);
        }else if( nextPathSeparator >= 0 && nextPathSeparator < curlyEndIndex) {
          // The curly brace is not closed before the next path segment starts
          // In this case we just treat it as a normal path segment and continute processing.

          // Condition 1: there is only a single opening curly brace: /{badToken/notokens
          // Condition 2: there is a curly brace and other tokens: /{badToken/:goodToken/{goodToken}
          winston.log('debug', '[SwaggerExporter] found invalid curly token in:', path);
          parameterizedPath += path.slice(0, nextPathSeparator);
          winston.log('debug', 'parametrizedPath is ', parameterizedPath);
          path = path.slice(nextPathSeparator);
          processedCurly = true;
        }else {
          // This is the last path segment so just copy it over
          winston.log('debug', '[SwaggerExporter] this is the last path segment');
          processedCurly = true;
          segment = path.slice(curlyStartIndex);
          parameter.name = segment.slice(2,segment.length-1);
          pathParameterObjects.push(parameter);

          parameterizedPath += path;
          winston.log('debug', 'parametrizedPath is ', parameterizedPath);
          path = '';
          processedCurly = true;
        }
      }
    }

    if( !processedCurly ) {

      winston.log('debug', '[SwaggerExporter] parametrized path segment uses a ":" token');
      let endIndex = path.indexOf('/', startIndex+2);
      if( endIndex > 0) {
        winston.log('debug', '[SwaggerExporter] found the end of this path segment');
        segment = path.slice(startIndex, endIndex)
      } else {
        winston.log('debug', '[SwaggerExporter] this is the last segment in the path');
        segment = path.slice(startIndex);
      }

      winston.log('debug', 'parametrized path segment is ', segment);
      parameter.name = segment.slice(2);
      pathParameterObjects.push(parameter);

      // Convert the fullpath of the node to use the "{}" syntax for dynamic segments in OAPI 2
      parameterizedPath += path.slice(0, startIndex) + '/{' + parameter.name + '}';
      winston.log('debug', 'parametrizedPath is ', parameterizedPath);

      // Get the path ready for further processing
      if( endIndex >= 0) {
        path = path.slice(endIndex);
      }else {
        path = '';
      }
      winston.log('debug', 'checking rest of path for paramterized segments:', path);
    }
  }

  // If there is any path left, stick it onto the end of the parameterizedPath
  parameterizedPath += path;
  return {
    parameterizedPath: parameterizedPath,
    pathParameterObjects: pathParameterObjects
  };

}

let convertNodeToPathItem = function(node, pathsObject) {
  winston.log('debug', '[SwaggerExporter] convertNodeToPathItem called for node: ', node);

  const validMethods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch'];
  let pathItem = {};
  let parameterizedPath = '';
  let pathParameterObjects = [];

  if( (node.fullpath.indexOf('/:') >= 0) || (node.fullpath.indexOf('/{') >= 0)) {
    // Find all the tokenized path segments and create parameters for them
    // /root/:segment/blah/:something/blah
    winston.log('debug', 'path contains parameters');
    let pathParameters = extractPathParameters(node);
    parameterizedPath = pathParameters.parameterizedPath;
    pathParameterObjects = pathParameters.pathParameterObjects;
  }

  Object.keys(node.data).forEach( (key) => {
    // console.log('******');
    // console.log('processing method data for node ', node.name);
    // console.log('key is ', key);
    // console.log('enabled: ', node.data[key].enabled);
    if( validMethods.indexOf(key) < 0 ) {
      // this is not a valid key
      winston.log('warn', 'unable to convert response method ' + key + ' into OpenAPI Spec');
    }else if(node.data[key].enabled){
      // Only extract enabled methods
      winston.log('debug', '[SwaggerExporter] procesing enabled data object: ', key);

      let operation = {};
      let nodeData = node.data[key];

      operation.description = "auto generated by Rapido";
      operation.produces = [nodeData.response.contentType];
      operation.consumes = [nodeData.request.contentType];

      //TODO: Don't use parameters if they are empty
      operation.parameters = [];

      if(pathParameterObjects.length > 0) {
        pathParameterObjects.forEach(parameterObject => {
          operation.parameters.push(parameterObject);
        })
      }

      if( nodeData.request.queryParams.trim().length > 0) {
        // Parse thq query parameter and create a parameter object for eqch query name
        let queryString = nodeData.request.queryParams.trim();

        if(queryString.startsWith('?')) {
          queryString = queryString.slice(1);
        }

        let queryStringTokens = queryString.split('&');
        queryStringTokens.forEach(query => {
          // Make all query values of type string for now
          let parameter = {
            name: '',
            in: 'query',
            type: 'string'
          };

          parameter.name = query.split('=')[0];
          operation.parameters.push(parameter);
        })
      }

      // If there is a request body defined, create a schema for it
      if( nodeData.request.body.trim().length > 0) {
        let requestBodyParameter = {
          name: 'request body',
          in: 'body',
          schema: {}
        };
        // Try to parse the string into a JSON object
        try {
          let jsonBody = JSON.parse(nodeData.request.body);
          requestBodyParameter.schema = generateSchema(jsonBody);
        }catch( e ) {
          if( e instanceof SyntaxError) {
            // This is not legal JSON, so treat it as a string
            winston.log('debug', '[SwaggerExporter] unable to parse JSON request body data:', e);
            requestBodyParameter.schema.type = 'string';
            requestBodyParameter.schema.description = 'Rapido was unable to parse the JSON request body from this sketch node'
          }
        }
        operation.parameters.push(requestBodyParameter);
      }

      operation.responses = {
        "200" : {
          "description": "auto generated by Rapido",
          "examples": {
          },
          "schema" : {
          }
        }
      };

      // Try to parse the string into a JSON object
      try {
        let jsonBody = JSON.parse(nodeData.response.body);
        operation.responses['200'].examples[nodeData.response.contentType] =
          jsonBody;
        operation.responses['200'].schema = generateSchema(jsonBody);
      }catch( e ) {
        if( e instanceof SyntaxError) {
          // This is not legal JSON, so treat it as a string
          winston.log('debug', '[SwaggerExporter] unable to parse JSON body data:', e);
          operation.responses['200'].examples['text/plain'] =
            nodeData.response.body;
          operation.responses['200'].schema = generateSchema(nodeData.response.body);

        }
      }
      pathItem[key] = operation;
    }else {
      winston.log('debug', '[SwaggerExporter] skipping disabled method: ', key)
    }
  });


  // Add this path itmem to the paths collection (if there are operations defined for it)
  if( Object.keys(pathItem).length > 0 ) {
    if( pathParameterObjects.length > 0 ) {
      winston.log('debug', '[SwaggerExporter] adding path object to paths with key ', parameterizedPath);
      pathsObject[parameterizedPath] = pathItem;
    }else  {
      winston.log('debug', '[SwaggerExporter] adding path object to paths with key ', node.fullpath);
      pathsObject[node.fullpath] = pathItem;
    }
  }

  // Process any children of this node recursively
  if( node.children) {
    node.children.forEach(child => {
      convertNodeToPathItem(child, pathsObject);
    })
  }

  //return pathItem;
}

SwaggerExporter.prototype.exportTree = function(tree, title, description) {

  winston.log('debug', '[SwaggerExporter] exportTree called.');
  let swaggerDoc = {json: {}, yaml: ''};

  let info = {
    title: (title ? title : ''),
    description: description,
    version: 'rapido-sketch'
  };

  // Build path objects based on the tree structure
  let paths = {

  }

  winston.log('debug', '[SwaggerExporter] parsing root nodes');
  if( tree.rootNode) {
    convertNodeToPathItem(tree.rootNode, paths);
  }

  winston.log('debug', '[SwaggerExporter] paths:', paths);


  swaggerDoc.json = {
    swagger: "2.0",
    info: info,
    paths: paths
  }

  winston.log('debug', '[SwaggerExporter] jsondoc:', swaggerDoc.json);

  swaggerDoc.yaml = objectToYaml(swaggerDoc.json);

  winston.log('debug', '[SwaggerExporter] returning swaggerdoc: ', swaggerDoc);

  return swaggerDoc;
}

module.exports = SwaggerExporter;
