"use strict";

const winston = require('winston');
const Promise = require('bluebird');
const SwaggerExporter = require('../../src/services/SwaggerExporter.js');
const Ajv = require('ajv');
const fs = require('fs');


fdescribe('SwaggerExporter', function() {

  let buildNode = function(name, fullpath, data) {
    return {
      name: name,
      fullpath: fullpath,
      childNodes: [],
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

  xit('should return a yaml representation', function() {
    let tree = { rootNodes: [], hash: {}};
    let title = 'test-title'
    let description = 'project description'

    let swaggerDoc = this.exporter.exportTree(tree, title, description);
    expect(swaggerDoc.yaml).toBeDefined();
    fail('to be implemented');
  })

  describe('valid path tests', function() {

    /*
    let createValidTree = function() {
      let createNode = function() {
        node.data[dataKey] = {
          contentType: '',
          enabled: false,
          queryParams: '',
          requestBody: '',
          responseBody: ''
        };
      }
      let tree = {
        rootNodes: [];
        hash: {};
      };


      tree.rootNodes.push()
    }
    */

    it('should return a single path with an empty get response', function() {
      let tree = { rootNodes: [], hash: {}};

      let node = {
        name: '/get-node',
        fullpath: '/somepath/get-node',
        childNodes: [],
        data: {
          get: {
            contentType: 'application/json',
            enabled: 'true',
            queryParams: '',
            requestBody: '',
            responseBody: ''
          }
        }
      }

      tree.rootNodes.push(node);

      let doc = this.exporter.exportTree(tree, '', '');
      expect(this.validate(doc.json)).toBe(true);
      expect(Object.keys(doc.json.paths).length).toBe(1);
      let path = doc.json.paths[node.fullpath];
      expect(path).toBeDefined();
      expect(Object.keys(path).length).toBe(1);
      expect(path.get).toBeDefined();

    })

    it('should return a single pathItem with a parameter body', function() {
      let tree = { rootNodes: [], hash: {}};

      let node = buildNode('/get-node', '/somepath/get-node', {
        get: {
            contentType: 'application/json',
            enabled: 'true',
            queryParams: '',
            requestBody: '{"test":"value"}',
            responseBody: ''
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

    xit('should return descendent nodes as pathItems', function() {
      let tree = { rootNodes: [], hash: {}};



      let root1 = buildNode('/root1', '/root1', {
        get: {
          contentType: 'application/json',
          enabled: 'true'
        }
      })

      let a = {
        name: '/get-node',
        fullpath: '/somepath/get-node',
        childNodes: [],
        data: {
          get: {
            contentType: 'application/json',
            enabled: 'true',
            queryParams: '',
            requestBody: '',
            responseBody: ''
          }
        }
      }

      tree.rootNodes.push(node);

    })

    xit('should not export data for a method that has been disabled', function() {
      fail('to be implemneted');
    })

  })

});
