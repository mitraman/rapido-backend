/**
 * @fileoverview Utilities for parsing ALPS documents
 * 
 */
var RSVP = require('rsvp');
var xml2js = require('xml2js');
var http = require('http');
 
/**
 * TBD
 * @param {string} format - 
 */
var parseDocument = function( format, document, callback) {
    if( format === 'json' ) {
        parseJSON(document, true).then(
            function(resolved) {
                callback(null, resolved);
            }, function(error) {
                callback(error);
            }
        );;
    }else if( format === 'xml' ) {
        parseXML(document, true).then(
            function(resolved) {
                callback(null, resolved);
            }, function(error) {
                callback(error);
            }
        );
    }
}

// Test code - move this to a test framework
/*
fs = require('fs');
fs.readFile('alps.xml', 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }
  //console.log(data);
  parseDocument('xml', data, function(error, result) {
      //console.log(error);
      console.log(result);
  });
});
*/

/**
 * Retrieve an ALPS document based on the URL, parse it and return as a JSON.  A content-type must be returned by the server
 * @param {Object} ALPSObject - a JSON ALPS document in javascript object form.
 * @param {function} callback - function({string} error, {Object} descriptorHash, {Array} descriptorTreeArray).
 */

function parseALPSDocument(href) {
    
    return new RSVP.Promise( function(resolve, reject) {
    
        if( href.substr(0, 'http://'.length) != 'http://' ) {
            reject('unsupported URI scheme in ' + href);
        }
        
        var suffix = href.substr('http://'.length, href.length);
        var pathLocation = suffix.indexOf("/");
        var host = suffix;
        var path = "";

        if( pathLocation > -1 ) {
            host = suffix.substr(0, pathLocation);
            path = suffix.substr(pathLocation, suffix.length);                               
        }

        // remove any fragments on the path
        if( path.indexOf('#') > -1 ) {
            path = path.substr(0, path.indexOf('#'));
        }
    
        var options = {
            host: host, 
            path: path,
            method: 'GET'
        }
        //console.log(options);
        
    
        var req = http.request(options, function(response) {
            var str = '';

            //another chunk of data has been recieved, so append it to `str`
            response.on('data', function (chunk) {
                str += chunk;
            });

            //the whole response has been recieved, so we just print it out here
            response.on('end', function () {
                //TODO: Validate that this is a valid ALPS document.
                resolve({body: str, headers: response.headers});
            });
        });
                    
        req.on('error', function(e) {
            reject(e);
        });
        
        req.end();        
    });
}

/************************************************************** 
 * JSON Parsing Routines 
 **************************************************************/

/**
 * Parse a JSON formatted ALPS document.
 * @param {Object} ALPSObject - a JSON ALPS document in javascript object form.
 * @param {function} callback - function({string} error, {Object} descriptorHash, {Array} descriptorTreeArray).
 */
 function parseJSON(ALPSObject, resolveHref) {
     console.log('parseJSON');
               
     if( resolveHref === null ) { resolveHref = true; }
               
     return new RSVP.Promise(function(resolve, reject) {
         
         // Validate that the root alps property exists
        var ALPSRoot = getProperty(ALPSObject, 'alps');
         console.log(ALPSRoot);

        if( ALPSRoot == null ) {
            console.log('no ALPS root');
            reject('No Root defined');	
        }

        var version = getProperty(ALPSRoot, 'version');		 
        var descriptor = getProperty(ALPSRoot, 'descriptor'); 	
         
        // recursively parse the descriptor objects
        if( !descriptor ) { 		
            resolve({});
        }else {
            var descriptors = {};

            //TODO: The logic already exists in the descriptor parser - it can be removed.
            // As per the spec, the descriptor property must be an array
            if(Object.prototype.toString.call( descriptor ).indexOf('Array') < 0 ) {
                reject('JSON descriptor property must be an array');        
            }

            var promises = [];

            // Get promises for each descriptor that needs to be parsed
            for( var i = 0; i < descriptor.length; i++ ) {
                promises.push(parseJSONDescriptor(descriptor[i]));
            }

            // Fire off all the promises and collate the results
            RSVP.all(promises).then(function(resolved) {
                console.log('JSON has been parsed...');                
                for( var i = 0; i < resolved.length; i++ ) {
                    var descriptorHash = resolved[i];
                    var keys = Object.keys(descriptorHash);
                    for( var j = 0; j < keys.length; j++ ) {
                        var key = keys[j];
                        var descriptor = descriptorHash[key];
                        descriptors[descriptor.id] = descriptor;
                    }
                    
                }
                
                //console.log('global hash:');
                //console.log(descriptorHash);
                
                // We should now have a hash object of all descriptors with links for parents and children
                // Now we can run a second pass to resolve internal and external hrefs
                
                
                
                 
                                //TODO: resolveHref should only apply to exteral docs, not local fragments
                    // This is unfinished code, so I'm checking for false.  In the future, I may want to resolve descriptors to grab doc 
                    // and other properties, this code can be used for that purpose.
                if( false && resolveHref ) {
                    var promises = [];
                    var descriptorKeys = Object.keys(descriptors);
                    for( var i = 0; i < descriptorKeys.length; i++ ) {
                        var descriptorId = descriptorKeys[i];
                        var descriptor = descriptors[descriptorId];
                        if( descriptor.href ) {
                            console.log('href: %s', descriptor.href);

                            if( descriptor.id === descriptor.href ) {
                                // This descriptor has a locally defined ID.  Acording to the spec, the local ID should override the ID 
                                // in the referenced descriptor.  Although there may be additional properties to be refernced by following
                                // the href, at this point we only care about id, so we can ignore this href.                            

                                console.log('retrieving...');
                                if(  descriptor.href.charAt(0) === '#' ) {
                                    console.log('fragment');
                                    //TODO: Do a local lookup for fragments.
                                } else {                                                                                                            
                                    console.log('ALPS document:');
                                    
                                    var dereferencePromise = new RSVP.Promise(function(resolve, reject) {
                                        console.log('dereferencePromise...');
                                        // Use a promise chain to first retrieve the external document and then parse it according to the content type
                                        parseALPSDocument(descriptor.href).then(                                            
                                            function( response ) {
                                                console.log('extneral document loaded')
                                                var contentType = response.headers['content-type'];
                                                var resolveHrefs = false;
                                                if( contentType.substr((contentType.length - 'xml'.length), contentType.length) === 'xml' ) {       
                                                    console.log('Parsing as XML');
                                                    return parseXML(response.body, resolveHrefs);
                                                }else {
                                                    reject('unknown content-type');
                                                }
                                            })
                                        .then(
                                            function( externalDescriptors ) {
                                                var href = descriptor.href;
                                                if( href.indexOf('#') > 0 ) {
                                                    var fragment = href.substr(href.indexOf('#') + 1, href.length);
                                                    console.log('***** LOOKING for %s', fragment);
                                                    console.log(externalDescriptors[fragment]);
                                                } else {
                                                    console.log('this is a non-framgment parse');
                                                                reject('not implemented yet.');
                                                }                                                
                                            },
                                            function( error ) {
                                                reject(error);
                                            });
                                    });
                                           
                                    console.log('pushing promise...');
                                    promises.push(dereferencePromise);
                                                  
                                                  /*
                                    parseALPSDocument(descriptor.href, function(error, response) {
                                        console.log(error);
                                        console.log(response.body);
                                        
                                        if( error ) {
                                            reject(error);
                                        } else {
                                            var contentType = response.headers['content-type'];
                                            if( contentType.substr((contentType.length - 'xml'.length), contentType.length) === 'xml' ) {       
                                                console.log('Parsing as XML');         
                                                var resolveHrefs = false;
                                                parseXML(response.body, resolveHrefs).then(function(resolved) {
                                                    //console.log(resolved);
                                                    ///resolve(descriptors);
                                                }, function(error) {
                                                    reject(error);
                                                });
                                            }else if( contentType.substr((contentType.length - 'json'.length), contentType.length) === 'json' ) {
                                                //console.log('Parsing as JSON');
                                            }
                                        }
                                        
                                    });
                                    */
                                }

                            }
                        }
                    }
                    
                    // Resolve any promises that were created
                    RSVP.all(promises).then(function(resolved) {
                        console.log('resolved');
                        console.log(resolved.length);
                        //console.log(resolved);
                        
                        for( var i = 0; i < resolved.length; i++ ) {
                            
                        }
                    }, function(error) {
                    });
                    
                    //resolve(descriptors);                    
                } else {
                    console.log('resolving...');
                    //console.log(descriptors);
                    resolve(descriptors);    
                }                
                
            }, function(error) {
                reject(error);
            });         		
        }
     });
 } 

/**
 * Parses an individual descriptor object
 * @param {Object} JSONdescriptor - The JSON object to parse. 
 */
function parseJSONDescriptor(JSONDescriptor) {        
    
    return new RSVP.Promise(function (resolve, reject) {            
        
        var descriptorHash = {};
        
        var descriptor = normalizeJSON(JSONDescriptor);        
        descriptor.parent = '*root*';
        descriptorHash[descriptor.id] = descriptor;   
        
        // If this descriptor has a child descriptor, parse the list
        if( !descriptor.descriptor ) {                  
            resolve(descriptorHash);
        } else {

            if(Object.prototype.toString.call( descriptor.descriptor  ).indexOf('Array') < 0 ) {
                reject('JSON descriptor property must be an array');        
            }
            
            var promises = [];
            
            for( var i = 0; i < descriptor.descriptor.length; i++ ) {
                promises.push(parseJSONDescriptor(descriptor.descriptor[i]));     
            }                                    
            
            RSVP.all(promises).then(function(resolvedArray) {
                // Store the child descriptors in our hash object and store a pointer to these children 
                // within the parent
                
                var children = [];
                for( var i = 0; i < resolvedArray.length; i++ ) {                    
                    var childHash = resolvedArray[i];
                    
                    // iterate through this hash and insert into the hash for this descriptor
                    var keys = Object.keys(childHash);
                    for( var j = 0; j < keys.length; j++ ) {
                        var descriptorId = keys[j];                        
                        var childDescriptor = childHash[descriptorId];
                        if( childDescriptor.parent === '*root*' ) {
                            childDescriptor.parent = descriptor.id;
                            children.push(childDescriptor.id);                            
                        }
                        descriptorHash[descriptorId] = childDescriptor;                        
                    }
                }
                                                        
                descriptor.children = children;  
                
                // remove the descriptor property
                delete descriptor.descriptor;
                
                resolve(descriptorHash);
            }, function(error) {
                reject(error);
            });            
        }         
    });
 }
 
/**
 * Converts a raw JSON descriptor into a normalized object.  Incorporates a case-insensitive conversion.
 * @param {Object} JSONdescriptor - The raw JSON object to parse 
 */

function normalizeJSON(JSONdescriptor) {
    var descriptor = {};

	// iterate through the descriptor and store the properties.
	// I'm iterating because of the need for case insensitivity.
	for( var propertyName in JSONdescriptor ) {

			var normalizedPropName = propertyName.toLowerCase();
                    
			if( normalizedPropName === 'descriptor') {
                descriptor.descriptor = JSONdescriptor[propertyName];				
			}

			else if( normalizedPropName === 'name') {
				descriptor.name = JSONdescriptor[propertyName];
			}

			else if( normalizedPropName === 'href') {
				// we will deref this link later.. for now just store the property.
				descriptor.href = JSONdescriptor[propertyName];
			}
        
            else if( normalizedPropName === 'id') {
				descriptor.id = JSONdescriptor[propertyName];
			}
			
			else if( normalizedPropName === 'ext') {
				descriptor.ext = JSONdescriptor[propertyName];
			}

			else if( normalizedPropName === 'type') {
				descriptor.type = JSONdescriptor[propertyName];
			}

			else if( normalizedPropName === 'doc') {
				descriptor.doc = JSONdescriptor[propertyName];
			}

		} 	
    
        if( !descriptor.id) {
            // If the id property is not defined, but an href is, temporarily set the ID = href for later resolution.  This allows us
            // to continue to build the tree without resolving hrefs until the second pass.
            //descriptor.id = descriptor.href;
            
            //TODO: Finish the external resolver.  For now we will temporarily do everything locally by using the fragment as the id
            if( descriptor.href ) {
                var href = descriptor.href;
                if( href.indexOf('#') > 0 ) {
                    var fragment = href.substr(href.indexOf('#') + 1, href.length);
                    descriptor.id = fragment;
                }
            }
            
            delete descriptor.href;
        }

		return descriptor;	 
 }
 
 function getProperty(obj, propertyName) {
	 for( property in obj) {
		 if( property.toUpperCase() === propertyName.toUpperCase()) return obj[property];
	 }

	 return null;
 }
 
 // A case insensitive search for a named property
 function findProperty(obj, propertyName) {
	 for( property in obj) {
		 if( property.toUpperCase() === propertyName.toUpperCase()) return property;
	 }

	 return null;
 }
    
/************************************************************** 
 * XML Parsing Routines 
 **************************************************************/

/**
 * Converts an ALPS XML document into a descriptor tree.  Returns an object hash of the root descriptors
 * @param {string} ALPSXMLProfile - An XML document string
 * @param {number} depth - the current depth of parsing.  Used to prevent circular references and recursion that is too deep
 */    
function parseXML(document, resolveHrefs) {    
                        
    return new RSVP.Promise(function(resolve, reject) {
        var descriptors = {};
            
        // Convert the XML into an ALPS compliant JSON object
        console.log('parsing...');
        xml2js.parseString(document, function (err, xml2jsResult) {
            if( err ) {
                reject(err);
            }
            var jsonALPS = {};
            jsonALPS.alps = {};
            
            jsonALPS.alps.descriptor = convertDescriptor(xml2jsResult.alps.descriptor);
            
                        
            parseJSON(jsonALPS, resolveHrefs).then(function(descriptors) {
                resolve(descriptors);
            }, function(error) {
                reject( error);
            });
            
        });                               
    });
}

/** converts a descriptor from the xml2js form into an ALPS compliant form **/
function convertDescriptor(srcDescriptors) {        
    var descriptors = [];
    
    function copyAttributes(src, dest) {
        var attrKeys = Object.keys(src);
        for( var i = 0; i < attrKeys.length; i++ ) {
            var id = attrKeys[i];
            dest[id] = src[id];
        }
    }
    
    for( var i =0; i < srcDescriptors.length; i++ ) {
        var srcDescriptor = srcDescriptors[i];
        
        var descriptor = {};
        
        // Copy attributes
        var attributes = srcDescriptor.$;        
        copyAttributes(attributes, descriptor);
        
        // Copy doc element
        if( srcDescriptor.doc ) {
            var doc = {};
            if( srcDescriptor.doc[0]._ ) {
                doc.value = srcDescriptor.doc[0]._;
            }
            if( srcDescriptor.doc[0].$ ) {
                // Copy attributes
                copyAttributes(srcDescriptor.doc[0].$, doc);
            }
            descriptor.doc = doc;
        }
        
        // Parse child descriptors
        if( srcDescriptor.descriptor ) {
            descriptor.descriptor = convertDescriptor(srcDescriptor.descriptor);
        }                
        
        descriptors.push(descriptor);
    }
    
    return descriptors;
}


module.exports = parseDocument;
