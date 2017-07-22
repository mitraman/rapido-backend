"use strict";

const RapidoErrorCodes = require('../../src/errors/codes.js');
const representer = require('../../src/representers/problem-detail.js')();

// TODO: Setup a simluated email service so that we can test the verification process.

describe('problem-detail representer', function() {

  describe('simple error message generator', function() {

    beforeAll(function(){
      this.code = RapidoErrorCodes.genericError;
      this.title = 'error title';
      this.detail = 'some details about the error';
      this.resolution = 'steps to resolve the error';
      this.GeneralErrorType = 'http://rapidodesigner.com/api/problems/general';
    })

    it('should populate type, title and detail fields', function() {
      let error = representer.errorMessage(this.code, this.title, this.detail, this.resolution);
      expect(error.type).toBe(this.GeneralErrorType);
      expect(error.title).toBe(this.title);
      expect(error.detail).toBe(this.detail);
    });

    it('should populate the application error code field', function() {
      let error = representer.errorMessage(this.code, this.title, this.detail, this.resolution);
      expect(error.code).toBe(this.code);
    });

    it('should populate the error resolution field', function() {
      let error = representer.errorMessage(this.code, this.title, this.detail, this.resolution);
      expect(error.resolution).toBe(this.resolution);
    })

  });

  describe('field validation error generator', function() {

    beforeAll(function() {
      this.code = RapidoErrorCodes.genericError;
      this.title = 'error title';
      this.detail = 'some details about the error';
      this.FieldValidationType = 'http://rapidodesigner.com/api/problems/field'
    })

    it('should popuate field validation information', function() {
      let fieldErrors = [
        {
          field: 'firstname',
          type: 'missing',
          description: 'First name is a required field'
        },
        {
          field: 'dateofbirth',
          type: 'invalid',
          description: 'Date of birth is in the wrong format'
        }
      ]
      let error = representer.fieldValidationMessage(this.code, this.title, this.detail, fieldErrors);
      expect(error.type).toBe(this.FieldValidationType);
      expect(error.code).toBe(this.code);
      expect(error.title).toBe(this.title);
      expect(error.fields).toEqual(fieldErrors);
    })

  })


})
