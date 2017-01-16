/**
This test doesn't run well as part of the test suite because the config
singleton is already loaded with values.  Disabling this for now
**/

var Config = require('../src/config.js');

describe('Configurator', function() {

  beforeEach(function() {
    Config.database = {};
    Config.port = undefined;
  })

  it('should load properties from the a json configuration file', function() {
      Config.load('../spec/test-config.json');
      expect(Config.database.host).toBe('1.2.3.4');
      expect(Config.database.port).toBe(39229);
      expect(Config.database.database).toBe('testing');
      expect(Config.database.user).toBe('postgres');
      expect(Config.database.password).toBe(undefined);
      //expect(Config.port).toBe(8092);
  })

  it( 'should load properties from environment variables if no json is specified', function() {
    process.env.RAPIDO_DATABASE_HOST = '10.9.8.7';
    process.env.RAPIDO_DATABASE_PORT = 14;
    process.env.RAPIDO_DATABASE_NAME = 'env-args';
    process.env.RAPIDO_DATABASE_USER = 'env-user';
    process.env.RAPIDO_DATABASE_PASSWORD = 'password';
    process.env.RAPIDO_PORT = 808;

    Config.load();
    expect(Config.database.host).toBe('10.9.8.7');
    expect(Config.database.port).toBe(14);
    expect(Config.database.database).toBe('env-args');
    expect(Config.database.user).toBe('env-user');
    expect(Config.database.password).toBe('password');
    expect(Config.port).toBe(808);

    delete process.env.RAPIDO_DATABASE_HOST;
    delete process.env.RAPIDO_DATABASE_PORT;
    delete process.env.RAPIDO_DATABASE_NAME;
    delete process.env.RAPIDO_DATABASE_USER;
    delete process.env.RAPIDO_DATABASE_PASSWORD;
    delete process.env.RAPIDO_PORT;

  })

  it( 'should override json properties with environment variable settings', function() {

  })

})
