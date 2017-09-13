"use strict";

const request = require("request");
const config = require('../../src/config.js');
const winston = require('winston');
const dataAccessor = require('../../src/db/DataAccessor.js');
const HandlerSupport = require('./support.js');
const sketchService = require('../../src/services/sketches.js');
const RapidoErrorCodes = require('../../src/errors/codes.js');
const RapidoError = require('../../src/errors/rapido-error.js');
const OA2Exporter = require('../../src/services/OA2Exporter.js');
const OA3Exporter = require('../../src/services/OA3Exporter.js');
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
        expect(res.statusCode).toBe(400);
        expect(jsonBody.code).toBe(RapidoErrorCodes.fieldValidationError);
        done();
      });
  })

  it('should export a sketch using the OAS2 Exporter when the fomat is oai2', function(done) {
    spyOn(OA2Exporter, 'exportTree').and.callThrough();

    request.get(
      {
        url: this.exporterUrl+'?format=oai2',
        headers: this.headers
      },function(err, res, body)  {
        let jsonBody = JSON.parse(body);
        expect(res.statusCode).toBe(200);
        expect(OA2Exporter.exportTree.calls.count()).toBe(1);
        expect(jsonBody.json).toBeDefined();
        expect(jsonBody.yaml).toBeDefined();
        done();
      });
  })

  it('should export a sketch using the OAS3 Exporter when the fomat is oai3', function(done) {
    console.log(OA3Exporter);
    spyOn(OA3Exporter, 'exportTree').and.callThrough();

    request.get(
      {
        url: this.exporterUrl+'?format=oai3',
        headers: this.headers
      },function(err, res, body)  {
        console.log(body);
        let jsonBody = JSON.parse(body);
        expect(res.statusCode).toBe(200);
        expect(OA3Exporter.exportTree.calls.count()).toBe(1);
        expect(jsonBody.json).toBeDefined();
        expect(jsonBody.yaml).toBeDefined();
        done();
      });
  })
});
