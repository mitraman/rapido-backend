"use strict";

const request = require("request");
const config = require('../../src/config.js');
const winston = require('winston');
const dataAccessor = require('../../src/db/DataAccessor.js');
const HandlerSupport = require('./support.js');
const sketchService = require('../../src/services/sketches.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const RapidoError = require('../../src/errors/rapido-error.js');
const fs = require('fs');

describe('handlers/exporter.js ', function() {

  beforeAll(function(done) {
    const db = dataAccessor.getDb();

    this.headers = {};
    const server_port = config.port;
    this.urlBase = 'http://localhost:' + server_port + '/api';

    // Register and login a test user
    HandlerSupport.registerAndLogin('ExporterTest')
    .then( (result) => {
      console.log('result is:' + result);
      const authValue = 'Bearer ' + result.token;
      this.headers['Authorization'] = authValue;
      this.userId = result.userId;

      // Create a test project
      return db.query("insert into projects (userid, name) values (" + this.userId + ", 'treeNodesTest') RETURNING id")
    }).then( result => {
      //console.log(result);
      this.projectId = result[0].id;
      return db.query("insert into sketches (userid, projectid, sketchIndex) values ("
        + this.userId + ", " + this.projectId + ", 1) RETURNING id, sketchIndex");
    }).then( result => {
      this.sketchIndex = 1;
      this.sketchId = result[0].id;
      this.exporterUrl = this.urlBase + '/projects/' + this.projectId + '/sketches/' + this.sketchIndex + '/export';
    }).catch( (error) => {
      console.log('something went wrong! ' + error);
      fail(error);
    }).finally(done);
  })

  beforeEach(function(done) {
    // Delete sketch data
    const db = dataAccessor.getDb();
    db.query('delete from sketchevents;')
    .then( () => {
      // Flush all subscribers
      return sketchService.reset();
    }).finally(done);

  })

  it('should reject an attempt to export a sketch in a project for a sketch that does not exist', function(done){
    let thisSpec = this;
    let badSketchUrl = this.urlBase + '/projects/' + this.projectId + '/sketches/21/export';

    request.get(
      {
        url: badSketchUrl,
        headers: this.headers
      },function(err, res, body)  {
        console.log(body);
        let jsonBody = JSON.parse(body);
        expect(res.statusCode).toBe(404);
        expect(jsonBody.code).toBe(RapidoErrorCodes.sketchNotFound);
        done();
      });
  });

  xit('should reject an attempt to export a sketch that does not belong to this user', function(done) {
    //TODO
  });

  it('should reject an attempt to export a sketch in an unknown format', function(done) {
    let badFormatUrl = this.exporterUrl + "?format=unknown"

    request.get(
      {
        url: badFormatUrl,
        headers: this.headers
      },function(err, res, body)  {
        let jsonBody = JSON.parse(body);
        console.log(jsonBody);
        expect(res.statusCode).toBe(400);
        expect(jsonBody.code).toBe(RapidoErrorCodes.fieldValidationError);
        done();
      });
  })

  describe('OpenAPI Specification 2.0', function() {

    beforeAll(function() {

      this.openAPIUrl = this.exporterUrl + "?format=oai2"


        // Setup validator for tests
      const Ajv = require('ajv');
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

    it('should export an OAI 2 document in JSON based on the media type', function(done) {
      //console.log(this.openAPIUrl);
      let thisSpec = this;
      let testHeaders = this.headers;
      testHeaders['Accept'] = 'application/json';

      request.get(
        {
          url: this.openAPIUrl,
          headers: testHeaders
        },function(err, res, body)  {
          expect(res.statusCode).toBe(200);
          //console.log(body);
          let jsonBody = JSON.parse(body);
          expect(jsonBody).toBeDefined();
          expect(thisSpec.validate(jsonBody)).toBe(true);
          done();
        });
    });

    it('should export an OAI 2 document in YAML based on the media type', function(done) {

      let thisSpec = this;
      let testHeaders = this.headers;
      testHeaders['Accept'] = 'application/yaml';

      request.get(
        {
          url: this.openAPIUrl,
          headers: testHeaders
        },function(err, res, body)  {
          //TODO: validate that this is a YAML document
          //console.log(body);
          expect(res.statusCode).toBe(200);
          done();
        });
    });

  })
});
