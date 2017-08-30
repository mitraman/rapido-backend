"use strict";

const winston = require('winston');
const Promise = require('bluebird');
const SwaggerExporter = require('../../src/services/SwaggerExporter.js');
const Ajv = require('ajv');
const fs = require('fs');
const jsdiff = require('diff')

describe('SwaggerExporter v2', function() {

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
    this.exporter = new SwaggerExporter();

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

  })

  it('should return an empty swagger doc if there is no root node defined', function() {
    let tree = { rootNode: null, hash: {}};

    let swaggerDoc = this.exporter.exportTree(tree)
    expect(swaggerDoc.json).not.toBeNull();
    expect(this.validate(swaggerDoc.json)).toBe(true);
    // console.log(this.validate.errors);
    // console.log(swaggerDoc.json);
  })

  it('should populate an empty swagger doc with default meta information', function() {
    let tree = { rootNode: null, hash: {}};
    let title = 'test-title'
    let description = 'project description'

    let swaggerDoc = this.exporter.exportTree(tree, title, description);
    expect(swaggerDoc.json.info.title).toBe(title);
    expect(swaggerDoc.json.info.description).toBe(description);
    expect(swaggerDoc.json.info.version).toBe('rapido-sketch');
    expect(this.validate(swaggerDoc.json)).toBe(true);
    // console.log(swaggerDoc.json);
    // console.log(this.validate.errors);

  })

  it('should set the content type and response status for a simple object', function() {
    let tree = { rootNode: null, hash: {}};
    let node = generateNode('/', '/', [], ['get']);

    let title = 'test-title'
    let description = 'project description'

    //tree.rootNodes.push(node);
    tree.rootNode = node;

    let doc = this.exporter.exportTree(tree, title, description);
    expect(this.validate(doc.json)).toBe(true);

    let path = doc.json.paths[node.fullpath];
    expect(path.get).toBeDefined();
    expect(path.get.consumes.length).toBe(1);
    expect(path.get.consumes[0]).toBe(node.data.get.request.contentType);
    expect(path.get.produces.length).toBe(1);
    expect(path.get.produces[0]).toBe(node.data.get.response.contentType);
    expect(Object.keys(path.get.responses).length).toBe(1);
    let responseObject = path.get.responses['200'];
    expect(responseObject).toBeDefined();
  })

  it('should populate the schema and example properties based on a simple object body', function() {
    let tree = { rootNodes: [], hash: {}};
    let node = generateNode('/node', '/node', [], ['get']);

    let title = 'test-title'
    let description = 'project description'

    node.data.get.response.body = '{"test": "value"}';
    tree.rootNode = node;

    let doc = this.exporter.exportTree(tree, title, description);
    expect(this.validate(doc.json)).toBe(true);

    let path = doc.json.paths[node.fullpath];
    let responseObject = path.get.responses['200'];
    expect(responseObject).toBeDefined();
    expect(responseObject.examples["application/json"]).toEqual(JSON.parse(node.data.get.response.body));
    expect(responseObject.schema).toBeDefined();
    expect(responseObject.schema.type).toBe('object');
    expect(responseObject.schema.properties["test"]).toBeDefined();

  })

  it('should set a schema with a type of string when the JSON body is invalid', function() {
    let tree = { rootNodes: [], hash: {}};
    let node = generateNode('/node', '/node', [], ['get']);

    let title = 'test-title'
    let description = 'project description'

    node.data.get.response.body = '{bad: "json"}';
    tree.rootNode = node;

    let doc = this.exporter.exportTree(tree, title, description);
    expect(this.validate(doc.json)).toBe(true);

    let path = doc.json.paths[node.fullpath];
    let responseObject = path.get.responses['200'];
    expect(responseObject.schema).toBeDefined();
    expect(responseObject.schema.type).toBe('string');
    expect(responseObject.examples["text/plain"]).toBe(node.data.get.response.body);
  })

  it('should generate a nested schema', function() {
    let tree = { rootNodes: [], hash: {}};
    let node = generateNode('/node', '/node', [], ['get']);

    let title = 'test-title'
    let description = 'project description'

    node.data.get.response.body = '{"name": "rootobject", "child": { "name": "child1", "test": "value", "gc": { "name": "grandchild"}}}';
    tree.rootNode = node;

    let doc = this.exporter.exportTree(tree, title, description);
    expect(this.validate(doc.json)).toBe(true);

    let path = doc.json.paths[node.fullpath];
    let responseObject = path.get.responses['200'];
    expect(responseObject.schema).toBeDefined();
    expect(responseObject.schema.type).toBe('object');
    expect(Object.keys(responseObject.schema.properties).length).toBe(2);
    let childObject = responseObject.schema.properties['child'];
    expect(childObject).toBeDefined();
    expect(childObject.type).toBe('object');
    expect(Object.keys(childObject.properties).length).toBe(3);
    let grandchildObject = childObject.properties['gc'];
    expect(grandchildObject).toBeDefined();
    expect(grandchildObject.type).toBe('object');
    expect(grandchildObject.properties['name'].type).toBe('string');
  })

  it('should set a schema type of number when a body property contains an integer', function() {
    let tree = { rootNodes: [], hash: {}};
    let node = generateNode('/node', '/node', [], ['get']);

    let title = 'test-title'
    let description = 'project description'

    node.data.get.response.body = '{"name": "rootobject", "number": 3992093}';
    tree.rootNode = node;

    let doc = this.exporter.exportTree(tree, title, description);
    expect(this.validate(doc.json)).toBe(true);

    let path = doc.json.paths[node.fullpath];
    let responseObject = path.get.responses['200'];
    expect(Object.keys(responseObject.schema.properties).length).toBe(2);
    expect(responseObject.schema.properties['number'].type).toBe('number');
  })

  it('sould set a schema type of array for a JSON array data type', function() {
    let tree = { rootNodes: [], hash: {}};
    let node = generateNode('/node', '/node', [], ['get']);

    let title = 'test-title'
    let description = 'project description'

    node.data.get.response.body = '{"name": "rootobject", "array1": ["val1", "val2"], "array2": [{"obj1_key": "value"}, "string", 1]}';
    tree.rootNode = node;

    /*
    array2 : {
        type: array,
        items: [
          {
            type: object,
            properties: {
              obj1_key: {
                type: string
              }
            }
          }
        ]
    }
    */

    let doc = this.exporter.exportTree(tree, title, description);
    expect(this.validate(doc.json)).toBe(true);

    let path = doc.json.paths['/node'];
    let responseObject = path.get.responses['200'];
    //console.log('responseObject:', responseObject);
    expect(responseObject.schema.type).toBe('object');
    expect(Object.keys(responseObject.schema.properties).length).toBe(3);
    //console.log(responseObject.schema);
    // console.log(responseObject.schema.properties['array2']);
    // console.log(responseObject.schema.properties['array2'].items[0]);

    expect(responseObject.schema.properties['array1'].type).toBe('array');
    expect(responseObject.schema.properties['array1'].items.type).toBe('string');

    expect(responseObject.schema.properties['array2'].type).toBe('array');
    expect(responseObject.schema.properties['array2'].items.length).toBe(3);
    expect(responseObject.schema.properties['array2'].items[0].type).toBe('object');
    expect(responseObject.schema.properties['array2'].items[0].properties.obj1_key.type).toBe('string');
    expect(responseObject.schema.properties['array2'].items[1].type).toBe('string');
    expect(responseObject.schema.properties['array2'].items[2].type).toBe('number');

  })

  it('should return a basic yaml representation', function(done) {
    let tree = { rootNodes: [], hash: {}};
    let title = 'test-title'
    let description = 'project description'

    let node = generateNode('/get-node', '/somepath/:paramsegment/get-node', [], ['get']);
    tree.rootNode = node;

    let swaggerDoc = this.exporter.exportTree(tree, title, description);
    expect(swaggerDoc.yaml).toBeDefined();
    // compare the yaml with the expected contents located in a file
    fs.readFile('spec/services/yaml/basic.yaml', 'utf8', function(err, data) {
      if (err) throw err;

      // Normalize CRLFs in the file if it was saved in Windows
      data = data.replace(/\r\n/g, '\n');
      expect(swaggerDoc.yaml.trim()).toBe(data.trim());
      //let diff = jsdiff.diffChars(swaggerDoc.yaml.trim(), data.trim());
      done();
    });
  })

  it('should return a yaml representation for more than one path and a complex schema', function(done) {
    let tree = { rootNodes: [], hash: {}};
    let title = 'test-title'
    let description = 'project description'

    let projectId = generateNode('/:projectId', '/projects/:projectId', [], ['get', 'delete']);
    projectId.data.get.response.body = '{"name": "rootobject", "array1": ["val1", "val2"], "array2": [{"obj1_key": "value"}, "string", 1]}';
    let projects = generateNode('/projects', '/projects', [projectId], ['get', 'post']);
    tree.rootNode = projects;

    let swaggerDoc = this.exporter.exportTree(tree, title, description);
    expect(swaggerDoc.yaml).toBeDefined();

    // compare the yaml with the expected contents located in a file
    fs.readFile('spec/services/yaml/paths.yaml', 'utf8', function(err, data) {
      if (err) throw err;
      // Normalize CRLFs in the file if it was saved in Windows
      data = data.replace(/\r\n/g, '\n');
      expect(swaggerDoc.yaml.trim()).toBe(data.trim());
      // let diff = jsdiff.diffChars(swaggerDoc.yaml.trim(), data.trim());
      // console.log(diff);
      done();
    });
  })

  it('should return a JSON example in the yaml representation', function(done) {
    let tree = { rootNodes: [], hash: {}};
    let title = 'test-title'
    let description = 'project description'

    let projectId = generateNode('/:projectId', '/projects/:projectId', [], ['get', 'delete']);
    let responseBody = {
      name: "testing",
      object: {
        arrayProperty: ["hello", "there"]
      },
      last: "one"
    }
    projectId.data.get.response.body = JSON.stringify(responseBody);
    let projects = generateNode('/projects', '/projects', [projectId], ['get', 'post']);
    tree.rootNode = projects;

    let swaggerDoc = this.exporter.exportTree(tree, title, description);
    expect(swaggerDoc.yaml).toBeDefined();

    // compare the yaml with the expected contents located in a file
    fs.readFile('spec/services/yaml/with-example.yaml', 'utf8', function(err, data) {
      if (err) throw err;
      // Normalize CRLFs in the file if it was saved in Windows
      data = data.replace(/\r\n/g, '\n');
      expect(swaggerDoc.yaml.trim()).toBe(data.trim());
      let diff = jsdiff.diffChars(swaggerDoc.yaml.trim(), data.trim());
      //console.log(diff);
      done();
    });
  })

  describe('valid path tests', function() {

    it('should return a single path with a JSON get response', function() {
      let tree = { rootNodes: [], hash: {}};
      let node = generateNode('/get-node', '/somepath/get-node', [], ['get']);
      tree.rootNode = node;

      let doc = this.exporter.exportTree(tree, '', '');
      expect(this.validate(doc.json)).toBe(true);
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
      expect(this.validate(doc.json)).toBe(true);
      expect(doc.json.paths['/root']).toBeDefined();
      expect(doc.json.paths['/root/a']).not.toBeDefined();
    })

    it('should generate a request body schema from a valid JSON body', function() {
      let node = generateNode('a', '/root/a', [], ['get']);
      node.data.get.request.body = '{"test": "works"}';
      let tree = { rootNodes: [], hash: {}};
      tree.rootNode = node;

      let doc = this.exporter.exportTree(tree, '', '');
      expect(this.validate(doc.json)).toBe(true);
      //console.log(this.validate.errors);
      let path = doc.json.paths[node.fullpath];
      expect(path).toBeDefined();
      let operation = path.get;
      expect(operation).toBeDefined();
      expect(operation.parameters.length).toBe(2);
      expect(operation.parameters[1].name).toBe('request body');
      expect(operation.parameters[1].in).toBe('body');
      expect(operation.parameters[1].schema).toBeDefined();
      let schema = operation.parameters[1].schema;
      expect(schema.properties.test.type).toBe('string');
    })

    it('should ignore an invalid json request body and generate a notification comment', function() {
      let node = generateNode('a', '/root/a', [], ['get']);
      node.data.get.request.body = '{badjson}';
      let tree = { rootNodes: [], hash: {}};
      tree.rootNode = node;

      let doc = this.exporter.exportTree(tree, '', '');
      expect(this.validate(doc.json)).toBe(true);
      let path = doc.json.paths[node.fullpath];
      expect(path).toBeDefined();
      let operation = path.get;
      expect(operation).toBeDefined();
      expect(operation.parameters.length).toBe(2);
      expect(operation.parameters[1].name).toBe('request body');
      expect(operation.parameters[1].in).toBe('body');
      expect(operation.parameters[1].schema).toBeDefined();
      let schema = operation.parameters[1].schema;
      expect(schema.type).toBe('string');
      expect(schema.description).toBeDefined();
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
      expect(this.validate(doc.json)).toBe(true);
      //console.log(this.validate.errors);
      let path = doc.json.paths[node.fullpath];
      expect(path).toBeDefined();
      let operation = path.get;
      expect(operation).toBeDefined();
      expect(operation.parameters.length).toBe(2);
      validateQuery(operation.parameters[0], 'queryName', 'aValue');
    })

    it('should generate a list of query properties from a valid query list', function() {
      let node = generateNode('a', '/root/a', [], ['get']);
      node.data.get.request.queryParams = '?query1=aValue&query2=anothervalue&query3=lastvalue&query4';
      let tree = { rootNodes: [], hash: {}};
      tree.rootNode = node;

      let doc = this.exporter.exportTree(tree, '', '');
      expect(this.validate(doc.json)).toBe(true);
      //console.log(this.validate.errors);
      let path = doc.json.paths[node.fullpath];
      expect(path).toBeDefined();
      let operation = path.get;
      expect(operation).toBeDefined();
      expect(operation.parameters.length).toBe(5);
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
      expect(this.validate(doc.json)).toBe(true);
      //console.log(this.validate.errors);
      let path = doc.json.paths['/root/a'];
      expect(path).toBeDefined();
      let operation = path.get;
      expect(operation).toBeDefined();
      expect(operation.parameters.length).toBe(3);

      validateQuery(operation.parameters[0], 'query1', 'aValue');
      validateQuery(operation.parameters[1], 'query2', 'anothervalue');

    })

    it('should generate a single query properties object from an invalid query string', function() {
      let node = generateNode('a', '/root/a', [], ['get']);
      node.data.get.request.queryParams = 'badquerystring!';
      let tree = { rootNodes: [], hash: {}};
      tree.rootNode = node;

      let doc = this.exporter.exportTree(tree, '', '');
      expect(this.validate(doc.json)).toBe(true);
      //console.log(this.validate.errors);
      let path = doc.json.paths[node.fullpath];
      expect(path).toBeDefined();
      let operation = path.get;
      expect(operation).toBeDefined();
      expect(operation.parameters.length).toBe(2);

      validateQuery(operation.parameters[0], 'badquerystring!');
    })

    it('should generate a path parameter object if the name of the path starts with a ":"', function() {
      let node = generateNode(':id', '/root/a/:id', [], ['get']);
      node.data.get.request.queryParams='?query=value';
      let tree = { rootNodes: [], hash: {}};
      tree.rootNode = node;

      let doc = this.exporter.exportTree(tree, '', '');
      expect(this.validate(doc.json)).toBe(true);
      //console.log(this.validate.errors);
      let path = doc.json.paths['/root/a/{id}'];
      expect(path).toBeDefined();
      let operation = path.get;
      expect(operation).toBeDefined();
      expect(operation.parameters.length).toBe(3);
      let pathParameter = operation.parameters[0];

      expect(pathParameter.name).toBe('id')
      expect(pathParameter.in).toBe('path');
      expect(pathParameter.type).toBe('string')
      expect(pathParameter.required).toBe(true);
    })

    it('should generate two path parameter objects if the path contains two parameter tokens', function() {
      let node = generateNode(':lastone', '/:root/:someId/another/:id/:lastone', [], ['get']);
      node.data.get.request.queryParams='?query=value';
      let tree = { rootNodes: [], hash: {}};
      tree.rootNode = node;

      let doc = this.exporter.exportTree(tree, '', '');
      expect(this.validate(doc.json)).toBe(true);
      let path = doc.json.paths['/{root}/{someId}/another/{id}/{lastone}'];
      expect(path).toBeDefined();
      let operation = path.get;
      expect(operation).toBeDefined();
      expect(operation.parameters.length).toBe(6);
      let pathParameter = operation.parameters[0];

      let validatePathParameter = function( name, paramObject) {
        expect(paramObject.name).toBe(name)
        expect(paramObject.in).toBe('path');
        expect(paramObject.type).toBe('string')
        expect(paramObject.required).toBe(true);
      }

      validatePathParameter('root', operation.parameters[0]);
      validatePathParameter('someId', operation.parameters[1]);
      validatePathParameter('id', operation.parameters[2]);
      validatePathParameter('lastone', operation.parameters[3]);


    })

    let validatePathParameter = function( name, paramObject) {
      expect(paramObject.name).toBe(name)
      expect(paramObject.in).toBe('path');
      expect(paramObject.type).toBe('string')
      expect(paramObject.required).toBe(true);
    }

    it('should generate a path parameter object if the name of the path is enclosed in curly brackets', function() {
      let node = generateNode(':lastone', '/root/{someId}/another/:id/{lastone}', [], ['get']);
      node.data.get.request.queryParams='?query=value';
      let tree = { rootNodes: [], hash: {}};
      tree.rootNode =node;

      let doc = this.exporter.exportTree(tree, '', '');
      expect(this.validate(doc.json)).toBe(true);
      let path = doc.json.paths['/root/{someId}/another/{id}/{lastone}'];
      expect(path).toBeDefined();
      let operation = path.get;
      expect(operation).toBeDefined();
      expect(operation.parameters.length).toBe(5);
      let pathParameter = operation.parameters[0];

      validatePathParameter('someId', operation.parameters[0]);
      validatePathParameter('id', operation.parameters[1]);
      validatePathParameter('lastone', operation.parameters[2]);
    })

    it('should ignore a path parameter object with an unclosed curly brace', function() {
      let node = generateNode(':lastone', '/root/{badParameter/another/:id/{lastone}', [], ['get']);
      node.data.get.request.queryParams='?query=value';
      let tree = { rootNodes: [], hash: {}};
      tree.rootNode = node;

      let doc = this.exporter.exportTree(tree, '', '');
      expect(this.validate(doc.json)).toBe(true);
      let path = doc.json.paths['/root/{badParameter/another/{id}/{lastone}'];
      expect(path).toBeDefined();
      let operation = path.get;
      expect(operation).toBeDefined();
      expect(operation.parameters.length).toBe(4);
      let pathParameter = operation.parameters[0];

      validatePathParameter('id', operation.parameters[0]);
      validatePathParameter('lastone', operation.parameters[1]);
    })

    it('should return descendent nodes as pathItems', function() {
      let tree = { rootNodes: [], hash: {}};

      let c = generateNode('/c-node', '/root1/a-node/c-node', [], ['put']);
      let b = generateNode('/b-node', '/root1/b-node', [], ['post']);
      let a = generateNode('/a-node', '/root1/a-node', [c], ['get']);
      let root1 = generateNode('/root1', '/root1', [a, b], ['get']);

      tree.rootNode = root1;

      let doc = this.exporter.exportTree(tree, '', '');
      expect(this.validate(doc.json)).toBe(true);
      expect(Object.keys(doc.json.paths).length).toBe(4);
      expect(doc.json.paths['/root1']).toBeDefined();
      expect(doc.json.paths['/root1/a-node']).toBeDefined();
      expect(doc.json.paths['/root1/b-node']).toBeDefined();
      expect(doc.json.paths['/root1/a-node/c-node']).toBeDefined();

      //console.log(JSON.stringify(doc.json), ' ');

    })

    it('should not export data for a method that has been disabled', function() {
      let tree = { rootNodes: [], hash: {}};

      let c = generateNode('/c-node', '/root1/a-node/c-node', [], ['put']);
      let b = generateNode('/b-node', '/root1/b-node', [], ['post', 'put', 'get']);
      b.data.put.enabled = false;
      let a = generateNode('/a-node', '/root1/a-node', [c], ['get']);
      a.data.get.enabled = false;
      let root1 = generateNode('/root1', '/root1', [a, b], ['get']);

      tree.rootNode = root1;

      let doc = this.exporter.exportTree(tree, '', '');
      expect(this.validate(doc.json)).toBe(true);
      expect(Object.keys(doc.json.paths).length).toBe(3);
      expect(doc.json.paths['/root1']).toBeDefined();
      expect(doc.json.paths['/root1/a-node']).not.toBeDefined();
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
