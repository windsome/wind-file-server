/* eslint key-spacing:0 spaced-comment:0 */
import path from 'path';
import _debug from 'debug';
const debug = _debug('app:config');

// ========================================================
// Default Configuration
// ========================================================
const config = {
  server_port: 3000,
  server_port_https: 3001,
  // ----------------------------------
  // Https Configuration
  // ----------------------------------
  // https: {
  //   key: fs.readFileSync(__dirname + '/2_mp.lancertech.net.key'),
  //   cert: fs.readFileSync(__dirname + '/1_mp.lancertech.net_cert.crt')
  // }

  // ----------------------------------
  // Project Structure
  // ----------------------------------
  path_base: path.resolve(__dirname, '../..'),

  aliyunVod: {
    AccessKeyId: '<your-accessKeyId>',
    AccessKeySecret: '<your-accessKeySecret>',
    RoleArn: 'acs:ram::1459759790853733:role/vod-upload'
  },
  qcloud: {
    appId: '<your-appId>',
    secretId: '<your-secretId>',
    secretKey: '<your-secretKey>'
  }
};

//export default config;
let nextcfg = require('./cfg.windsome').default(config);
export default nextcfg;
