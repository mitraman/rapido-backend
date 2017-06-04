const asciidoctor = require('asciidoctor.js')();

const options = {
  attributes: ['stylesheet=rapidodoc.css', 'stylesdir=css'],
  safe: 'safe',
  header_footer: true
};
// var registry = asciidoctor.Extensions.create();
// var opts = {};
// opts[asciidoctorVersionGreaterThan('1.5.5') ? 'extension_registry' : 'extensions_registry'] = registry;
// require('docs/extensions/test.js')(registry);

asciidoctor.convertFile(__dirname + '/main.asciidoc', options);
