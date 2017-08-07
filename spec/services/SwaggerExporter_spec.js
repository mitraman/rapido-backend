"use strict";

const winston = require('winston');
const Promise = require('bluebird');
const SwaggerExporter = require('../../src/services/SwaggerExporter.js');
const Ajv = require('ajv');
const fs = require('fs');

describe('SwaggerExporter v2', function() {

  let buildNode = function(name, fullpath, data) {
    if( !data ) {
      data = {
        get: {
          enabled: 'true',
          request: {
            contentType: 'application/json',
            queryParams: '',
            body: ''
          },
          response: {
            contentType: 'application/json',
            status: '200',
            body: ''
          }
        }
      }
    }

    return {
      name: name,
      fullpath: fullpath,
      children: [],
      data: data
    }
  };

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

  it('should return an empty swagger doc if the tree is empty', function() {
    let tree = { rootNodes: [], hash: {}};

    let swaggerDoc = this.exporter.exportTree(tree)
    expect(swaggerDoc.json).not.toBeNull();
    expect(this.validate(swaggerDoc.json)).toBe(true);
    // console.log(this.validate.errors);
    // console.log(swaggerDoc.json);
  })

  it('should populate an empty swagger doc with default meta information', function() {
    let tree = { rootNodes: [], hash: {}};
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
    let tree = { rootNodes: [], hash: {}};
    let node = buildNode('/node', '/node');

    let title = 'test-title'
    let description = 'project description'

    tree.rootNodes.push(node);

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
    let node = buildNode('/node', '/node');

    let title = 'test-title'
    let description = 'project description'

    node.data.get.response.body = '{"test": "value"}';
    tree.rootNodes.push(node);

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
    let node = buildNode('/node', '/node');

    let title = 'test-title'
    let description = 'project description'

    node.data.get.response.body = '{bad: "json"}';
    tree.rootNodes.push(node);

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
    let node = buildNode('/node', '/node');

    let title = 'test-title'
    let description = 'project description'

    node.data.get.response.body = '{"name": "rootobject", "child": { "name": "child1", "test": "value", "gc": { "name": "grandchild"}}}';
    tree.rootNodes.push(node);

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
    let node = buildNode('/node', '/node');

    let title = 'test-title'
    let description = 'project description'

    node.data.get.response.body = '{"name": "rootobject", "number": 3992093}';
    tree.rootNodes.push(node);

    let doc = this.exporter.exportTree(tree, title, description);
    expect(this.validate(doc.json)).toBe(true);

    let path = doc.json.paths[node.fullpath];
    let responseObject = path.get.responses['200'];
    expect(Object.keys(responseObject.schema.properties).length).toBe(2);
    expect(responseObject.schema.properties['number'].type).toBe('number');
  })

  xit('sould set a schema type of array for a JSON array data type', function() {

  })

  it('should return a yaml representation', function() {
    let tree = { rootNodes: [], hash: {}};
    let title = 'test-title'
    let description = 'project description'

    let node = {
      name: '/get-node',
      fullpath: '/somepath/get-node',
      children: [],
      data: {
        get: {
          enabled: 'true',
          request: {
            contentType: 'application/json',
            queryParams: '',
            body: ''
          },
          response: {
            contentType: 'application/json',
            status: '200',
            body: '{"test": "value"}'
          }
        }
      }
    }

    tree.rootNodes.push(node);

    // Conver the yaml back to JSON so we can validate it
    let yaml2json = function(yamlDoc) {
      let jsonObject = {};
      let currentIndentLevel = 0;
      let objectStack = [];
      objectStack.push({ name: null, obj: {}});

      // Read until new line
      let yamlLines = yamlDoc.split('\n');
      yamlLines.forEach(yamlLine => {
        // Check the indent level
        let lineIndent = yamlLine.search(/\S|$/);

        if(yamlLine.trim().length !== 0) {
          // If the indent level is less than the current level, pop the parent object
          if( lineIndent < currentIndentLevel) {
            let childObject = objectStack.pop();
            objectStack[objectStack.length-1].obj[childObject.name.trim()] = childObject.obj;
          }

          currentIndentLevel = lineIndent;

          // parse each line
          let yamlTokens = yamlLine.split(':');

          // if there is no value, this is an object
          if( yamlTokens.length > 1 && yamlTokens[1].trim().length === 0) {
            // add the parent object to the object stack
            objectStack.push({ name: yamlTokens[0], obj: {} });

          }else {
            // Add these properties to the last object in the stack
            let key = yamlTokens[0].trim();
            if( key.startsWith('-') ) {
              // This is an array item
              if( !Array.isArray(objectStack[objectStack.length-1]) ) {
                objectStack[objectStack.length-1].obj = [];
              }
              objectStack[objectStack.length-1].obj.push(key);
            }else {
              let val = yamlTokens[1].trim();
              objectStack[objectStack.length-1].obj[key] = val;
            }

          }
        }
      })

      // Pop all the remaining child objects from the stack
      let stackLength = objectStack.length;
      for( let i = 0; i < stackLength-1; i++ ) {
        let childObject = objectStack.pop();
        let name = childObject.name.trim();
        objectStack[objectStack.length-1].obj[name] = childObject.obj;

      }
      jsonObject = objectStack.pop().obj;
      return jsonObject;
    }

    let swaggerDoc = this.exporter.exportTree(tree, title, description);
    expect(swaggerDoc.yaml).toBeDefined();
    let convertedYaml = yaml2json(swaggerDoc.yaml);
    let path = convertedYaml.paths[node.fullpath];
    expect(path).toBeDefined();
    expect(path.get).toBeDefined();
    expect(path.get.produces.length).toBe(1);
  })

  describe('valid path tests', function() {

    it('should return a single path with a JSON get response', function() {
      let tree = { rootNodes: [], hash: {}};

      let node = {
        name: '/get-node',
        fullpath: '/somepath/get-node',
        children: [],
        data: {
          get: {
            enabled: 'true',
            request: {
              contentType: 'application/json',
              queryParams: '',
              body: ''
            },
            response: {
              contentType: 'application/json',
              status: '200',
              body: '{"test": "value"}'
            }
          }
        }
      }

      tree.rootNodes.push(node);

      let doc = this.exporter.exportTree(tree, '', '');
      expect(this.validate(doc.json)).toBe(true);
      expect(Object.keys(doc.json.paths).length).toBe(1);
      let path = doc.json.paths[node.fullpath];
      expect(path).toBeDefined();
    })

    xit('should treat an invalid JSON body as a string', function() {

    })

    it('should return a single pathItem with a parameter body', function() {
      let tree = { rootNodes: [], hash: {}};

      let node = buildNode('/get-node', '/somepath/get-node', {
        get: {
          enabled: 'true',
          request: {
            contentType: 'application/json',
            queryParams: '',
            body: '{"test":"value"}'
          },
          response: {
            contentType: 'application/json',
            status: '200',
            body: ''
          }
        }
      });

      tree.rootNodes.push(node);

      let doc = this.exporter.exportTree(tree, '', '');
      expect(this.validate(doc.json)).toBe(true);
      let path = doc.json.paths[node.fullpath];
      expect(path).toBeDefined();
      expect(path.get).toBeDefined();
      let parameterObj = path.get.parameters

    })

    it('should return descendent nodes as pathItems', function() {
      let tree = { rootNodes: [], hash: {}};

      let root1 = buildNode('/root1', '/root1', {
        get: {
          enabled: 'true',
          request: {
            contentType: 'application/json',
            queryParams: '',
            body: ''
          },
          response: {
            contentType: 'application/json',
            status: '200',
            body: ''
          }
        }
      });

      let root2 = buildNode('/root2', '/root2');

      let a = {
        name: '/a-node',
        fullpath: '/root1/a-node',
        children: [],
        data: {
          get: {
            enabled: 'true',
            request: {
              contentType: 'application/json',
              queryParams: '',
              body: ''
            },
            response: {
              contentType: 'application/json',
              body: ''
            }
          }
        }
      }

      let b = {
        name: '/b-node',
        fullpath: '/root1/b-node',
        children: [],
        data: {
          post: {
            enabled: 'true',
            request: {
              contentType: 'application/json',
              queryParams: '',
              body: '{"key":"value"}'
            },
            response: {
              status: "201",
              contentType: 'application/json',
              body: '{"result": "success"}'
            }
          }
        }
      }

      let c = {
        name: '/c-node',
        fullpath: '/root1/a-node/c-node',
        children: [],
        data: {
          put: {
            enabled: 'true',
            request: {
              contentType: 'application/json',
              queryParams: '',
              body: ''
            },
            response: {
              contentType: 'application/json',
              status: "200",
              body: ''
            }
          }
        }
      }

      a.children = [c]
      root1.children = [a, b];

      tree.rootNodes.push(root1, root2);

      let doc = this.exporter.exportTree(tree, '', '');
      expect(this.validate(doc.json)).toBe(true);
      expect(Object.keys(doc.json.paths).length).toBe(5);
      let root1Path = doc.json.paths[root1.fullpath];
      let root2Path = doc.json.paths[root2.fullpath];
      expect(root1Path).toBeDefined();
      expect(root2Path).toBeDefined();

      //console.log(JSON.stringify(doc.json), ' ');

    })

    xit('should not export data for a method that has been disabled', function() {
      fail('to be implemneted');
    })

  })

});
