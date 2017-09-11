const Config = require('../src/config.js');

describe('Configurator', function() {

  beforeEach(function() {
    // Clone the config singleton
    this.config = Object.create(Config);
    // Config.database = {};
    // Config.port = undefined;
  })

  fit('should do something', function() {
    this.config.load();
    expect(this.config.loaded).toBe(true);
  })

  it('should load properties from the a json configuration file', function() {
      this.config.load('test-config.json');
      expect(this.config.database.host).toBe('1.2.3.4');
      expect(this.config.database.port).toBe(39229);
      expect(this.config.database.database).toBe('testing');
      expect(this.config.database.user).toBe('postgres');
      expect(this.config.database.password).toBe(undefined);
      //expect(Config.port).toBe(8092);
  })

  fit( 'should load properties from environment variables if no json is specified', function() {

    let originalEnv = JSON.parse(JSON.stringify(process.env));
    //console.log(originalEnv);

    let restoreProperty = function(propName) {
      delete process.env[propName];
      if( originalEnv[propName]) {
        process.env[propName] = originalEnv[propName];
      }
    }

    let setEnv = function(propName, value) {
      process.env[propName] = value;
    }

    setEnv('RAPIDO_DATABASE_HOST', '10.9.8.7');
    setEnv('RAPIDO_DATABASE_PORT', 14);
    setEnv('RAPIDO_DATABASE_NAME', 'env-args');
    setEnv('RAPIDO_DATABASE_USER', 'env-user');
    setEnv('RAPIDO_DATABASE_PASSWORD', 'password');
    setEnv('RAPIDO_PORT', 808);

    this.config.load();
    expect(this.config.database.host).toBe('10.9.8.7');
    expect(this.config.database.port).toBe(14);
    expect(this.config.database.database).toBe('env-args');
    expect(this.config.database.user).toBe('env-user');
    expect(this.config.database.password).toBe('password');
    expect(this.config.port).toBe(808);

    restoreProperty('RAPIDO_DATABASE_HOST');
    restoreProperty('RAPIDO_DATABASE_PORT');
    restoreProperty('RAPIDO_DATABASE_NAME');
    restoreProperty('RAPIDO_DATABASE_USER');
    restoreProperty('RAPIDO_DATABASE_PASSWORD');
    restoreProperty('RAPIDO_PORT');

  })

  xit( 'should override json properties with environment variable settings', function() {

  })

})
