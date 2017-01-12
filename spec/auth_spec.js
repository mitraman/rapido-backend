var request = require("request");
var setup = require('../src/setup');

// Setup
const server_port = 8080;
// start the databse and server and add the login handler
const db_port = 32770;
const db_host = '192.168.99.100';
const db_name = 'rapido';
const db_user = 'postgres';
const db_password = 'password';

let db = setup.initDB(db_host, db_port, db_name, db_user, db_password);
let server = setup.initServer();

require('../src/handlers/users.js')(server, db);

// Start the server
server.listen(server_port, function () {
  console.log('%s listening at %s', server.name, server.url);
});

beforeEach(function() {


})

afterEach(function() {

})

describe('Authentication', function() {

    describe('invalid credentials', function() {
        it('should reject invalid credentials', function(done) {
          let url = 'http://localhost:' + server_port + '/login';
          request.get({url: url},
          function(err, res, body) {
            expect(body).toBe('hi');
          })
/*            request
            .post({url: 'http://baduser:badpass@localhost:8081/login'},
              function(err, res, body) {
              expect(res.status).toBe(401);
            });*/
        })
    })
  });


describe('testing', function() {
  it('should fail', function() {
    expect(1).toBe(2);
  })
})


// shut down
server.close();
