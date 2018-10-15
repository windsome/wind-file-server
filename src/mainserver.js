import _debug from 'debug';
const debug = _debug('app:mainserver');
import 'isomorphic-fetch';
import Koa from 'koa';
import convert from 'koa-convert';
import cors from 'koa2-cors';
// import cfg from './cfg';
import Errcode, { EC, EM } from './Errcode';
const fs = require('fs');
const mkdirp = require('mkdirp');
import serve from 'koa-static';
import mount from 'koa-mount';

let packageJson = require('../package.json');
debug('SOFTWARE VERSION:', packageJson.name, packageJson.version);

const app = new Koa();
app.proxy = true;

// 跨域支持
app.use(
  cors({
    origin: ctx => {
      return '*';
      // if (ctx.url === '/test') {
      //     return "*"; // 允许来自所有域名请求
      // }
      // return 'http://localhost:8080'; / 这样就能只允许 http://localhost:8080 这个域名的请求了
    },
    // exposeHeaders: ['WWW-Authenticate', 'Server-Authorization'],
    // maxAge: 5,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE']
    // allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
  })
);

let bodyParser = require('koa-bodyparser');
app.use(convert(bodyParser()));

app.use(async (ctx, next) => {
  let dbginfo = {
    // cookieHeader: ctx.headers.cookie,
    clientIP:
      (ctx.request.header && ctx.request.header['X-Real-IP']) || ctx.request.ip,
    query: ctx.request.query,
    body: ctx.request.body,
    referer: ctx.req.headers.referer,
    // Authorization: ctx.request.header && ctx.request.header['Authorization'],
    // header: ctx.request.header
  };
  debug('[' + ctx.method + '] ' + ctx.path, dbginfo);
  await next();
});

let cfg = {
  folder: '/home/data/uploads'
};
if (!cfg.folder) {
  debug('error! cfg.folder is null!');
  process.exit(-1);
}
if (!fs.existsSync(cfg.folder)) mkdirp.sync(cfg.folder);
debug('init uploader! uploads in ', cfg.folder);

// static
app.use(mount('/uploads', serve(cfg.folder)));

// uploaders.
let ApiBase64 = require('./uploader/api-base64').default;
app.up_base64 = new ApiBase64(app, cfg);

let ApiForm = require('./uploader/api-form').default;
app.up_form = new ApiForm(app, cfg);

let ApiChunked = require('./uploader/api-chunked').default;
app.up_chunked = new ApiChunked(app, cfg);

// let ApiLocalServerV2 = require('./uploader/api-local-server.v2').default;
// app.localServerV2 = new ApiLocalServerV2(router);

// let ApiLocalServerV3 = require('./uploader/api-local-server.v3').default;
// app.localServerV3 = new ApiLocalServerV3(router);

// let ApiQcloud = require('./uploader/api-qcloud').default;
// app.Qcloud = new ApiQcloud(router, cfg.qcloud);

// let ApiAliyun = require('./uploader/api-aliyun.v2').default;
// app.Aliyun = new ApiAliyun(router, cfg.aliyunVod);

app.use(function(ctx, next) {
  debug('not done! [' + ctx.req.method + '] ' + ctx.path, ctx.req.url);
  ctx.status = 404;
});

export default app;
