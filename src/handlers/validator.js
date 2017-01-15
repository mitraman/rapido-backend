"use strict";

function validator() {

  return (function(req, res, next) {

    if( req.method === 'POST') {

      if( !req.is('application/json') && req.body) {
        res.send(400, "POST body must have a content type of JSON");
        return;
      }
    }

    next();
  });

}

module.exports = validator;
