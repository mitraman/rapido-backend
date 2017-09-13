"use strict";

const winston = require('winston');
const Promise = require('bluebird');
const OA3Exporter = require('../../src/services/OA3Exporter.js');
const Ajv = require('ajv');
const fs = require('fs');
const jsdiff = require('diff')

describe('Open API spec v3 exporter', function() {

  // Generates a simple test node that can be customized if needed
  let generateNode = function(name, fullpath, children, operations) {
    let node = {
      name: name,
      fullpath: fullpath,
      children: children,
      data: {}
    };

    if(operations) {
      operations.forEach(operationName => {
        node.data[operationName] = {
          enabled: true,
          request: {
            contentType: 'application/json',
            queryParams: '?' + name + '.' +  operationName + '.queryParams',
            body: name + '.' + operationName + '.request.body'
          },
          response: {
            contentType: 'application/json',
            status: '200',
            body: name + '.' +  operationName + '.response.body'
          }
        };
      });
    }

    return node;
  }

  beforeAll( function() {
    this.exporter = OA3Exporter;

    // NOTE: need to wait for the schema for v3 to be avialable
    /*
    // Load the open API Spec schema
    let fileContents = fs.readFileSync("spec/services/schema/swagger-schema.json");
    let swaggerSchema = JSON.parse(fileContents);

    // Use ajv with a v4 schema (as per https://github.com/epoberezkin/ajv/releases/tag/5.0.0)
    let ajv = new Ajv({
      meta: false, // optional, to prevent adding draft-06 meta-schema
      extendRefs: true, // optional, current default is to 'fail', spec behaviour is to 'ignore'
      unknownFormats: 'ignore',  // optional, current default is true (fail)
      // ...
    });

    var metaSchema = require('ajv/lib/refs/json-schema-draft-04.json');
    ajv.addMetaSchema(metaSchema);
    ajv._opts.defaultMeta = metaSchema.id;

    // optional, using unversioned URI is out of spec, see https://github.com/json-schema-org/json-schema-spec/issues/216
    ajv._refs['http://json-schema.org/schema'] = 'http://json-schema.org/draft-04/schema';

    // Optionally you can also disable keywords defined in draft-06
    ajv.removeKeyword('propertyNames');
    ajv.removeKeyword('contains');
    ajv.removeKeyword('const');

    this.validate = ajv.compile(swaggerSchema);
    */

  })

  it('should return an empty OpenAPI3 doc with required properties if there is no root node defined', function() {
    let tree = { rootNode: null, hash: {}};

    let oa3Doc = this.exporter.exportTree(tree, 'title', 'description');
    expect(oa3Doc.json).not.toBeNull();
    expect(oa3Doc.json.openapi).toBe('3.0.0');
    expect(oa3Doc.json.info).toBeDefined();
    expect(oa3Doc.json.info.title).toBe('title');
    expect(oa3Doc.json.info.description).toBe('description');
    expect(oa3Doc.json.info.version).toBe('rapido-sketch');
  })

  it('should set the content type and response status for a simple object', function() {
    let tree = { rootNode: null, hash: {}};
    let node = generateNode('/', '/', [], ['get']);

    let title = 'test-title'
    let description = 'project description'

    //tree.rootNodes.push(node);
    tree.rootNode = node;

    let doc = this.exporter.exportTree(tree, title, description);

    let path = doc.json.paths['/'];
    expect(path.get).toBeDefined();
    expect(path.get.requestBody).toBeDefined();
    expect(path.get.requestBody.content).toBeDefined();
    expect(path.get.requestBody.content['text/plain']).toBeDefined();
    expect(path.get.responses).toBeDefined();
    expect(path.get.responses['200'].content).toBeDefined();
    expect(path.get.responses['200'].description).toBeDefined();
    expect(path.get.responses['200'].content['text/plain']).toBeDefined();
  })

  it('should populate the schema and example properties based on a simple object body', function() {
    let tree = { rootNodes: [], hash: {}};
    let node = generateNode('/node', '/node', [], ['get']);

    let title = 'test-title'
    let description = 'project description'

    node.data.get.response.body = '{"test": "value"}';
    tree.rootNode = node;

    let doc = this.exporter.exportTree(tree, title, description);
    //expect(this.validate(doc.json)).toBe(true);

    let path = doc.json.paths[node.fullpath];
    let responseObject = path.get.responses['200'];
    expect(responseObject).toBeDefined();
    expect(responseObject.content['application/json']).toBeDefined();
    let mediaObject = responseObject.content['application/json'];
    expect(mediaObject.schema).toBeDefined();
    expect(mediaObject.schema.type).toBe('object');
    expect(mediaObject.schema.properties["test"]).toBeDefined();
    expect(mediaObject.example).toEqual(JSON.parse(node.data.get.response.body));
  })

  it('should generate a schema of type object with no propeties if the body is an empty object', function() {
    let tree = { rootNodes: [], hash: {}};
    let node = generateNode('/node', '/node', [], ['get']);

    let title = 'test-title'
    let description = 'project description'

    node.data.get.response.body = '{}';
    node.data.get.request.body = '';
    tree.rootNode = node;

    let doc = this.exporter.exportTree(tree, title, description);

    let path = doc.json.paths[node.fullpath];
    let responseObject = path.get.responses['200'];
    expect(responseObject).toBeDefined();
    expect(responseObject.content['application/json'].example).toEqual(JSON.parse(node.data.get.response.body));
    expect(responseObject.content['application/json'].schema).toBeDefined();
    expect(responseObject.content['application/json'].schema.type).toBe('object');
    expect(responseObject.content['application/json'].schema.properties).not.toBeDefined();
  })

  it('should generate a schema of type string with no properties if the body is an empty string', function() {
    let tree = { rootNodes: [], hash: {}};
    let node = generateNode('/node', '/node', [], ['get']);

    let title = 'test-title'
    let description = 'project description'

    node.data.get.response.body = '';
    tree.rootNode = node;

    let doc = this.exporter.exportTree(tree, title, description);

    let path = doc.json.paths[node.fullpath];
    let responseObject = path.get.responses['200'];
    expect(responseObject).toBeDefined();
    expect(responseObject.content['text/plain'].example).toBe('');
    expect(responseObject.content['text/plain'].schema).toBeDefined();
    expect(responseObject.content['text/plain'].schema.type).toBe('string');
    expect(responseObject.content['text/plain'].schema.properties).not.toBeDefined();
  })

  it('should set a schema with a type of string when the JSON body is invalid', function() {
    let tree = { rootNodes: [], hash: {}};
    let node = generateNode('/node', '/node', [], ['get']);

    let title = 'test-title'
    let description = 'project description'

    node.data.get.response.body = '{bad: "json"}';
    tree.rootNode = node;

    let doc = this.exporter.exportTree(tree, title, description);

    let path = doc.json.paths[node.fullpath];
    let responseObject = path.get.responses['200'];
    expect(responseObject.content['text/plain'].schema).toBeDefined();
    expect(responseObject.content['text/plain'].schema.type).toBe('string');
    expect(responseObject.content['text/plain'].example).toBe(node.data.get.response.body);
  })

  it('should generate a nested schema', function() {
    let tree = { rootNodes: [], hash: {}};
    let node = generateNode('/node', '/node', [], ['get']);

    let title = 'test-title'
    let description = 'project description'

    node.data.get.response.body = '{"name": "rootobject", "child": { "name": "child1", "test": "value", "gc": { "name": "grandchild"}}}';
    tree.rootNode = node;

    let doc = this.exporter.exportTree(tree, title, description);

    let path = doc.json.paths[node.fullpath];
    let responseObject = path.get.responses['200'];
    expect(responseObject.content['application/json'].schema).toBeDefined();
    expect(responseObject.content['application/json'].schema.type).toBe('object');
    expect(Object.keys(responseObject.content['application/json'].schema.properties).length).toBe(2);
    let childObject = responseObject.content['application/json'].schema.properties['child'];
    expect(childObject).toBeDefined();
    expect(childObject.type).toBe('object');
    expect(Object.keys(childObject.properties).length).toBe(3);
    let grandchildObject = childObject.properties['gc'];
    expect(grandchildObject).toBeDefined();
    expect(grandchildObject.type).toBe('object');
    expect(grandchildObject.properties['name'].type).toBe('string');
  })

  it('should return a basic yaml representation', function() {
    let tree = { rootNodes: [], hash: {}};
    let title = 'test-title'
    let description = 'project description'

    let node = generateNode('/get-node', '/somepath/:paramsegment/get-node', [], ['get']);
    tree.rootNode = node;

    let doc = this.exporter.exportTree(tree, title, description);
    expect(doc.yaml).toBeDefined();
    expect(doc.yaml.length).toBeGreaterThan(0);
  })

  describe('valid path tests', function() {

    it('should return a single path with a JSON get response', function() {
      let tree = { rootNodes: [], hash: {}};
      let node = generateNode('/get-node', '/somepath/get-node', [], ['get']);
      tree.rootNode = node;

      let doc = this.exporter.exportTree(tree, '', '');
      expect(Object.keys(doc.json.paths).length).toBe(1);
      let path = doc.json.paths[node.fullpath];
      expect(path).toBeDefined();
    })

    it('should ignore a path that has no method content defined', function() {
      let a = generateNode('a', '/root/a', [], []);
      console.log(a);
      let parent = generateNode('parent', '/root', [a], ['get'] );
      let tree = { rootNodes: [], hash: {}};
      tree.rootNode = parent;

      let doc = this.exporter.exportTree(tree, '', '');
      expect(doc.json.paths['/root']).toBeDefined();
      expect(doc.json.paths['/root/a']).not.toBeDefined();
    })

    it('should generate a request body schema from a valid JSON body', function() {
      let node = generateNode('a', '/root/a', [], ['get']);
      node.data.get.request.body = '{"test": "works"}';
      let tree = { rootNodes: [], hash: {}};
      tree.rootNode = node;

      let doc = this.exporter.exportTree(tree, '', '');
      let path = doc.json.paths[node.fullpath];
      expect(path).toBeDefined();
      //console.log(path.get.requestBody.content['application/json'].schema);
      expect(path.get.requestBody).toBeDefined();
      expect(path.get.requestBody.content['application/json'].schema).toBeDefined();
      expect(path.get.requestBody.content['application/json'].schema.properties.test.type).toBe('string');
    })

    let validateQuery = function(queryParam, name, value) {
      expect(queryParam.name).toBe(name);
      expect(queryParam.in).toBe('query');
      /*
      if(value) {
        expect(queryParam.description).toBe('Example: ?'+name+'=' + value);
      }else {
        expect(queryParam.description).toBe('Example: ?'+name);
      }
      */
      expect(queryParam.type).toBe('string');
    }

    it('should generate a query properties object from a valid query string', function() {
      let node = generateNode('a', '/root/a', [], ['get']);
      node.data.get.request.queryParams = '?queryName=aValue';
      let tree = { rootNodes: [], hash: {}};
      tree.rootNode = node;

      let doc = this.exporter.exportTree(tree, '', '');
      let path = doc.json.paths[node.fullpath];
      expect(path).toBeDefined();
      let operation = path.get;
      expect(operation).toBeDefined();
      expect(operation.parameters.length).toBe(1);
      validateQuery(operation.parameters[0], 'queryName', 'aValue');
    })

    it('should generate a list of query properties from a valid query list', function() {
      let node = generateNode('a', '/root/a', [], ['get']);
      node.data.get.request.queryParams = '?query1=aValue&query2=anothervalue&query3=lastvalue&query4';
      let tree = { rootNodes: [], hash: {}};
      tree.rootNode = node;

      let doc = this.exporter.exportTree(tree, '', '');
      let path = doc.json.paths[node.fullpath];
      expect(path).toBeDefined();
      let operation = path.get;
      expect(operation).toBeDefined();
      expect(operation.parameters.length).toBe(4);
      validateQuery(operation.parameters[0], 'query1', 'aValue');
      validateQuery(operation.parameters[1], 'query2', 'anothervalue');
      validateQuery(operation.parameters[2], 'query3', 'lastvalue');
      validateQuery(operation.parameters[3], 'query4');
    })

    it('should generate a list of query properties if the question mark is ommitted from the beginning', function() {
      let node = generateNode('a', '/root/a', [], ['get']);
      node.data.get.request.queryParams = 'query1=aValue&query2=anothervalue';
      let tree = { rootNodes: [], hash: {}};
      tree.rootNode = node;

      let doc = this.exporter.exportTree(tree, '', '');
      let path = doc.json.paths['/root/a'];
      expect(path).toBeDefined();
      let operation = path.get;
      expect(operation).toBeDefined();
      expect(operation.parameters.length).toBe(2);

      validateQuery(operation.parameters[0], 'query1', 'aValue');
      validateQuery(operation.parameters[1], 'query2', 'anothervalue');

    })

    it('should generate a single query properties object from an invalid query string', function() {
      let node = generateNode('a', '/root/a', [], ['get']);
      node.data.get.request.queryParams = 'badquerystring!';
      let tree = { rootNodes: [], hash: {}};
      tree.rootNode = node;

      let doc = this.exporter.exportTree(tree, '', '');
      let path = doc.json.paths[node.fullpath];
      expect(path).toBeDefined();
      let operation = path.get;
      expect(operation).toBeDefined();
      expect(operation.parameters.length).toBe(1);

      validateQuery(operation.parameters[0], 'badquerystring!');
    })

    it('should generate a path parameter object if the name of the path starts with a ":"', function() {
      let node = generateNode(':id', '/root/a/:id', [], ['get']);
      node.data.get.request.queryParams='?query=value';
      let tree = { rootNodes: [], hash: {}};
      tree.rootNode = node;

      let doc = this.exporter.exportTree(tree, '', '');
      let path = doc.json.paths['/root/a/{id}'];
      expect(path).toBeDefined();
      expect(path.parameters.length).toBe(1);
      let pathParameter = path.parameters[0];
      expect(pathParameter.name).toBe('id')
      expect(pathParameter.in).toBe('path');
      expect(pathParameter.required).toBe(true);
    })

    let validatePathParameter = function( name, paramObject) {
      expect(paramObject.name).toBe(name)
      expect(paramObject.in).toBe('path');
      expect(paramObject.required).toBe(true);
    }

    it('should generate two path parameter objects if the path contains two parameter tokens', function() {
      let node = generateNode(':lastone', '/:root/:someId/another/:id/:lastone', [], ['get']);
      node.data.get.request.queryParams='?query=value';
      let tree = { rootNodes: [], hash: {}};
      tree.rootNode = node;

      let doc = this.exporter.exportTree(tree, '', '');
      let path = doc.json.paths['/{root}/{someId}/another/{id}/{lastone}'];
      expect(path).toBeDefined();
      let operation = path.get;
      expect(operation).toBeDefined();
      expect(operation.parameters.length).toBe(1);
      expect(path.parameters.length).toBe(4);

      validatePathParameter('root', path.parameters[0]);
      validatePathParameter('someId', path.parameters[1]);
      validatePathParameter('id', path.parameters[2]);
      validatePathParameter('lastone', path.parameters[3]);


    })

    it('should generate a path parameter object if the name of the path is enclosed in curly brackets', function() {
      let node = generateNode(':lastone', '/{root}/{someId}/another/:id/{lastone}', [], ['get']);
      node.data.get.request.queryParams='?query=value';
      let tree = { rootNodes: [], hash: {}};
      tree.rootNode =node;

      let doc = this.exporter.exportTree(tree, '', '');
      let path = doc.json.paths['/{root}/{someId}/another/{id}/{lastone}'];
      expect(path).toBeDefined();
      let operation = path.get;
      expect(operation).toBeDefined();
      expect(path.parameters.length).toBe(4);

      validatePathParameter('root', path.parameters[0]);
      validatePathParameter('someId', path.parameters[1]);
      validatePathParameter('id', path.parameters[2]);
      validatePathParameter('lastone', path.parameters[3]);
    })

    it('should ignore a path parameter object with an unclosed curly brace', function() {
      let node = generateNode(':lastone', '/root/{badParameter/another/:id/{lastone}', [], ['get']);
      node.data.get.request.queryParams='?query=value';
      let tree = { rootNodes: [], hash: {}};
      tree.rootNode = node;

      let doc = this.exporter.exportTree(tree, '', '');
      let path = doc.json.paths['/root/{badParameter/another/{id}/{lastone}'];
      expect(path).toBeDefined();
      let operation = path.get;
      expect(operation).toBeDefined();
      expect(path.parameters.length).toBe(2);

      validatePathParameter('id', path.parameters[0]);
      validatePathParameter('lastone', path.parameters[1]);
    })

    it('should return descendent nodes as pathItems', function() {
      let tree = { rootNodes: [], hash: {}};

      let c = generateNode('/c-node', '/root1/a-node/c-node', [], ['put']);
      let b = generateNode('/b-node', '/root1/b-node', [], ['post']);
      let a = generateNode('/a-node', '/root1/a-node', [c], ['get']);
      let root1 = generateNode('/root1', '/root1', [a, b], ['get']);

      tree.rootNode = root1;

      let doc = this.exporter.exportTree(tree, '', '');
      expect(Object.keys(doc.json.paths).length).toBe(4);
      expect(doc.json.paths['/root1']).toBeDefined();
      expect(doc.json.paths['/root1/a-node']).toBeDefined();
      expect(doc.json.paths['/root1/b-node']).toBeDefined();
      expect(doc.json.paths['/root1/a-node/c-node']).toBeDefined();

      //console.log(JSON.stringify(doc.json), ' ');

    })

    it('should not export data for a method that has been disabled', function() {
      //NOTE: this test case also tests if a path is removed when it doesn't have
      // any enabled methods at all.  This should be its own test case
      let tree = { rootNodes: [], hash: {}};

      let c = generateNode('/c-node', '/root1/a-node/c-node', [], ['put']);
      let b = generateNode('/b-node', '/root1/b-node', [], ['post', 'put', 'get']);
      b.data.put.enabled = false;
      let a = generateNode(':a-node', '/root1/:a-node', [c], ['get']);
      a.data.get.enabled = false;
      let root1 = generateNode('/root1', '/root1', [a, b], ['get']);

      tree.rootNode = root1;

      let doc = this.exporter.exportTree(tree, '', '');
      expect(Object.keys(doc.json.paths).length).toBe(3);
      expect(doc.json.paths['/root1']).toBeDefined();
      expect(doc.json.paths['/root1/{a-node}']).not.toBeDefined();
      expect(doc.json.paths['/root1/b-node']).toBeDefined();
      expect(doc.json.paths['/root1/a-node/c-node']).toBeDefined();

      let bPath = doc.json.paths['/root1/b-node'];
      expect(Object.keys(bPath).length).toBe(2);
      expect(bPath['get']).toBeDefined();
      expect(bPath['put']).not.toBeDefined();
      expect(bPath['post']).toBeDefined();
    })

  })

});
