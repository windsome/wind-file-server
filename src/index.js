///////////////////////////////////////////////////
// koa web server for all APPs.
///////////////////////////////////////////////////
var http = require('http');
var https = require('https');
var fs = require('fs');

require('babel-register');
let server = require('./mainserver').default;
let _debug = require('debug');
const debug = _debug('app:bin:server');
const config = require('./cfg').default;

const port = process.env.PORT || config.server_port || 3000;
const port_https = process.env.PORT_HTTPS || config.server_port_https || 3001;
const https_enable = process.env.HTTPS_ENABLE || false;

http.createServer(server.callback()).listen(port);
debug(`Server accessible via http://localhost:${port} `);
if (https_enable) {
  const https_ssl = config.https;
  https.createServer(https_ssl, server.callback()).listen(port_https);
  debug(`Server accessible via https://localhost:${port_https} `);
}
