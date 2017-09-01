"use strict";

let CRUD = function () {
}

let generateMethodData = function(data, methodName, statusCode, requestBody, responseBody) {
  data[methodName] = {
    enabled: false,
    request: {
      contentType: 'application/json',
      queryParams: '',
      body: requestBody
    },
    response: {
      contentType: 'application/json',
      status: statusCode,
      body: responseBody
    }
  }
}

let generateNode = function() {
  let newNode = {
      name: '',
      fullpath: '',
      data: {}
  }

  generateMethodData(newNode.data, 'get', '200', '', '{\n}');
  generateMethodData(newNode.data, 'put', '200', '{\n}', '{\n}');
  generateMethodData(newNode.data, 'post', '201', '{\n}', '{\n}');
  generateMethodData(newNode.data, 'delete', '204', '', '');
  generateMethodData(newNode.data, 'patch', '200', '{\n}', '{\n}');

  return newNode;
}

CRUD.prototype.createRootNode = function() {
  let rootNode = generateNode();
  rootNode.type = 'root';
  rootNode.name = '/';
  rootNode.fullpath = '/';
  return rootNode;
}

CRUD.prototype.createNode = function() {

  let node = generateNode();
  node.type = 'node';
  return node;

}

module.exports = new CRUD();
