"use strict";

const winston = require('winston');
const Promise = require('bluebird');
const JSONSchemaUtils = require('./JSONSchemaUtils.js')
const YAMLUtils = require('./YAMLUtils.js');

/**
* Export functions for OpenAPISpec 3
*/
var OA3Exporter = function () {
};


/**
Identifies dynamic path segments ({segment} and :segment)
*/
let extractDynamicSegments = function(path) {
  let dynamicPathSegments = [];
  let remainingPath = path;

  // We are looking for two types of dynamic path segments -
  // colon segments (:segment)
  // curly brace sgements: ({segment})
  let colonDelim = remainingPath.indexOf('/:');
  let curlyDelim = remainingPath.indexOf('{');

  winston.log('debug', '[OA3Exporter] looking for dynamic path segments');

  // winston.log('debug', '[OA3Exporter] first colon delimiter index:', colonDelim);
  // winston.log('debug', '[OA3Exporter] first curly brace delimiter index:', curlyDelim);

  // Keep processing the path until we run out of delimiters
  while(colonDelim >= 0 || curlyDelim >= 0) {

    winston.log('debug', '[OA3Exporter] processing path segments in:', remainingPath);

    // Process a :segment next if there are no more {segment}s or the :segment is first
    if( (curlyDelim < 0) || (colonDelim < curlyDelim && colonDelim >= 0) ) {

      winston.log('debug', '[OA3Exporter] extracting :segment');

      // read until the path segment delimiter ('/') or the end of the string
      let segmentDelim = remainingPath.indexOf('/', colonDelim + 2);

      // If the end of there is no '/', use the end of the line
      segmentDelim = (segmentDelim >= 0) ? segmentDelim : remainingPath.length;

      let segment = remainingPath.slice(colonDelim+2, segmentDelim);
      let sourceToken = remainingPath.slice(colonDelim+1, segmentDelim);
      winston.log('debug', '[OA3Exporter] extracted segment: ', segment);
      dynamicPathSegments.push({source: sourceToken, value: segment});

      // Change the remainingPath to process the rest of the string
      remainingPath =  remainingPath.slice(segmentDelim);

    // The {segment} is next to be processed becuase it is first or there are no more :segments left
    }else {
      winston.log('debug', '[OA3Exporter] extracting {segment}');

      let curlyCloseDelim = remainingPath.indexOf('}');
      let segmentDelim = remainingPath.indexOf('/', curlyDelim);
      // If there is no '/', use the end of the line
      segmentDelim = (segmentDelim >= 0) ? segmentDelim : remainingPath.length;

      // Make sure there is a closing curly brace for this segment
      if( curlyCloseDelim < 0 ) {
        winston.log('debug', '[OA3Exporter] no closing curly brace found for segment in path: ', path);
        // Skip to the end of the line or the path delimiter
        remainingPath = remainingPath.slice(segmentDelim);
      }else if(segmentDelim < curlyCloseDelim) {
        // The path segment delimiter was found before the closing brace
        // Example: /{badse/gment}/segment
        winston.log('debug', '[OA3Exporter] curly brace segment terminated by segment delimiter in path: ', path);
        remainingPath = remainingPath.slice(segmentDelim);
      }else {
        let segment =  remainingPath.slice(curlyDelim+1, curlyCloseDelim);
        let sourceToken = remainingPath.slice(curlyDelim, curlyCloseDelim+1);
        winston.log('debug', '[OA3Exporter] extracted segment: ', segment);
        dynamicPathSegments.push({source: sourceToken, value: segment});

        // Change the remainingPath to process the rest of the string
        remainingPath =  remainingPath.slice(segmentDelim);
      }
    }

    // Look for the next delimiters
    colonDelim = remainingPath.indexOf('/:');
    curlyDelim = remainingPath.indexOf('{');
    // console.log('colonDelim:', colonDelim);
    // console.log('curlyDelim:', curlyDelim);
    // console.log(remainingPath);
  }

  return dynamicPathSegments;

}

let normalizeParameterizedPath = function (path, dynamicPathSegments) {
  let parameterizedPath = path;
  // Convert any segmented style path segments (:segment) to the OAS3 curly brace style ({segment})
  dynamicPathSegments.forEach(dynamicSegment => {
    if( !dynamicSegment.source.startsWith('{') ) {
      winston.log('debug', '[OA3Exporter] normalizing path segment:', dynamicSegment.source);
      // This isn't an OAS style segment, so convert it
      parameterizedPath = parameterizedPath.replace(dynamicSegment.source,
        '{' + dynamicSegment.value +  '}');
    }
  })

  return parameterizedPath;
}


let convertNodeToPathItem = function(node, paths) {
  winston.log('debug', '[OA3Exporter] convertNodeToPathItem called for node: ', node);

  const validMethods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch'];
  let pathItem = {};

  let dynamicSegments = extractDynamicSegments(node.fullpath);

  // Normalize the path for OAS3
  let parameterizedPath = normalizeParameterizedPath(node.fullpath, dynamicSegments);

  // Create a set of path parameters based on the dynamic segments we've identified
  let pathParameters = [];
  dynamicSegments.forEach(dynamicSegment => {
    pathParameters.push({
      name: dynamicSegment.value,
      in: 'path',
      required: true,
    })
  });

  Object.keys(node.data).forEach( key => {
    if( validMethods.indexOf(key) < 0 ) {
      // this is not a valid key
      winston.log('warn', 'unable to convert response method ' + key + ' into OpenAPI Spec');
    }else if(node.data[key].enabled === true){

      winston.log('debug', '[OA3Exporter] processing enabled operation for method ', key );

      let operation = {};

      // Create an empty operation object
      operation.requestBody = { content: {}};
      operation.responses = {};

      let nodeData = node.data[key];

      // Initialize the reqeustBody and response properties for this operation object
      let requestContent = {
        schema: {},
        example: ''
      }
      let responseContent = {
        schema: {},
        example: ''
      }
      operation.requestBody.description = 'Automatically generated by Rapido'
      operation.responses[nodeData.response.status] = { content: {} };
      operation.responses[nodeData.response.status].description = 'Automatically generated by Rapido';

      // Generate JSON schemas based on the message bodies

      let generateMediaObject = function(contentType, body) {
        let mediaObject = {};
        if( contentType === 'application/json') {
          try {
            let jsonBody = JSON.parse(body);
            mediaObject[contentType] = { schema: {}, example: {}};
            mediaObject[contentType].schema = JSONSchemaUtils.generateSchema(jsonBody);
            mediaObject[contentType].example = jsonBody;
            return mediaObject;
          }catch (e) {
            if( e instanceof SyntaxError ) {
              // If the parsing failed, treat the body as plain text
              mediaObject['text/plain'] = { schema: {}, example: {}};
              mediaObject['text/plain'].schema = JSONSchemaUtils.generateSchema(body);
              mediaObject['text/plain'].example = body;
              return mediaObject;
            }
          }
        }else {
          winston.log('warning', '[OA3Exporter] ignoring unsupported media type ', contentType);
        }
      }

      operation.responses[nodeData.response.status].content =
        generateMediaObject(nodeData.response.contentType, nodeData.response.body);

      operation.requestBody.content =
        generateMediaObject(nodeData.request.contentType, nodeData.request.body);

      operation.parameters = [];

      // Generate query parameters
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

      // Add the operation object to the path item
      pathItem[key] = operation;
    }
  });


  // Don't store the pathItem if there is no data defined for it
  if( Object.keys(pathItem).length > 0) {
    paths[parameterizedPath] = pathItem;
    // If there are any path parameters add them
    if( pathParameters.length > 0) {
      pathItem.parameters = pathParameters;
    }
  }

  // Process any children of this node recursively
  if( node.children) {
    node.children.forEach(child => {
      convertNodeToPathItem(child, paths);
    })
  }


}

OA3Exporter.prototype.exportTree = function(tree, title, description) {

  winston.log('debug', '[OA3Exporter] exportTree called.');
  let oa3Doc = {json: {}, yaml: ''};

  let info = {
    title: (title ? title : ''),
    description: description,
    version: 'rapido-sketch'
  };

  winston.log('debug', '[OA3Exporter] parsing root node');
  let paths = {};
  if( tree.rootNode) {
     convertNodeToPathItem(tree.rootNode, paths);
  }
  winston.log('debug', '[OA3Exporter] paths:', paths);

  oa3Doc.json = {
    openapi: '3.0.0',
    info: info,
    paths: paths
  }

  winston.log('debug', '[OA3Exporter] jsondoc:', oa3Doc.json);
  oa3Doc.yaml = YAMLUtils.objectToYaml(oa3Doc.json);

  return oa3Doc;
}

module.exports = new OA3Exporter();
