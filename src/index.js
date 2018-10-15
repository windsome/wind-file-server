///////////////////////////////////////////////////
// koa web server for all APPs.
///////////////////////////////////////////////////
require('babel-register');
var http = require('http');

var server = require('./mainserver').default;
var _debug = require('debug');
const debug = _debug('app:server');

const port = process.env.PORT || 3000;

http.createServer(server.callback()).listen(port);
debug(`Server accessible via http://localhost:${port} `);
