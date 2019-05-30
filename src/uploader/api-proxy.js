import request from 'request';
import Errcode, { EC, EM } from '../Errcode';
import _debug from 'debug';
const debug = _debug('app:api-proxy');

export default class Uploader {
  constructor(app, cfg) {
    // save opts.
    this.app = app;
    this.cfg = cfg;

    debug('init uploader!');
    // init router for apis.
    this.registerServices();
  }

  registerServices() {
    let prefix = '/apis/v1/upload/proxy';
    let router = require('koa-router')({ prefix });
    router.get('/:url', this.proxyUrl);
    // router.all('/:url', this.proxyUrl);

    this.app.use(async (ctx, next) => {
      // debug('registerServices', ctx.path)
      if (ctx.path.startsWith(prefix)) {
        try {
          // debug('path:', ctx.path, prefix);
          let result = await next();
        } catch (e) {
          debug('error:', e);
          let errcode = e.errcode || -1;
          let message = EM[errcode] || e.message || '未知错误';
          ctx.body = { errcode, message, xOrigMsg: e.message };
        }
        return;
      } else {
        await next();
      }
    });
    this.app.use(router.routes()).use(router.allowedMethods());
    this.app.use(async (ctx, next) => {
      if (ctx.path.startsWith(prefix)) {
        ctx.body = {
          errcode: -2,
          message: 'no such api: ' + ctx.path
        };
        return;
      }
      await next();
    });
  }

  /**
   * @api {POST} /apis/v1/upload/proxy 代理前端图片
   * @apiDescription 绕过图片等资源的跨域访问问题
   * @apiName proxyUrl
   * @apiGroup LocalServerV2
   * @apiVersion 1.0.0
   * @apiParam {String} url="http://xxxx/test.jpg" 必选 文件url
   * @apiSuccess {Object}
   * @apiError error
   */
  proxyUrl = async (ctx, next) => {
    let url = ctx.params.url;
    debug('proxyUrl1', url);
    if (!url) {
      throw new Errcode('error! no url', EC.ERR_NO_URL);
    }
    url = Buffer.from(url, 'base64').toString();
    ctx.body = request.get(url);
  };
}
