"use strict";

const winston = require('winston');
const Promise = require('bluebird');

let DirectedGraphEventProcessor = function () {
};


DirectedGraphEventProcessor.graphnode_moved = function(event, graph) {
  winston.log('debug', '[DirectedGraphEventProcessor.graphnode_moved] applying graphnode_moved event: ', event);
  return graph;
}

DirectedGraphEventProcessor.graphnode_removed = function(event, graph) {
  winston.log('debug', '[DirectedGraphEventProcessor.graphnode_removed] applying graphnode_removed event: ', event);
  return graph;
}

DirectedGraphEventProcessor.graphnode_added = function(event, graph) {
  winston.log('debug', '[DirectedGraphEventProcessor.graphnode_added] applying graphnode_added event: ', event);
  return graph;
}

DirectedGraphEventProcessor.graphnode_updated_fields = function(event, graph) {
  let node = graph.hash[event.data.nodeId];
  if( !node ) {
    throw new Error('unable to locate node to be udated.');
  }

  return graph;
}

DirectedGraphEventProcessor.graphnode_updated_data = function(event, graph ) {
  winston.log('debug', '[DirectedGraphEventProcessor.graphnode_updated_data] applying graphnode_updated_data event: ', event);
  let node = tree.hash[event.data.nodeId];


  return graph;
}

module.exports = new DirectedGraphEventProcessor();
