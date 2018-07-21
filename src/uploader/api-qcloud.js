import _debug from 'debug';
const debug = _debug('app:api-qcloud');

import getAuthorizationCos from './qcloud-cos';
import getAuthorizationVod from './qcloud-vod';
import Errcode, { EC, EM } from '../Errcode';

export default class Uploader {
  constructor(app, config) {
    // save opts.
    this.app = app;
    this.config = config;
    debug('init uploader! qcloud!');

    this.authCOS = this.authCOS.bind(this);
    this.authVOD = this.authVOD.bind(this);

    // init router for apis.
    this.registerServices();
  }

  registerServices() {
    let prefix = '/apis/v1/upload/qcloud';
    let router = require('koa-router')({ prefix });
    router.get('/authcos', this.authCOS);
    router.get('/authvod', this.authVOD);

    this.app.use(async (ctx, next) => {
      debug('path:', ctx.path, prefix);
      if (ctx.path.startsWith(prefix)) {
        try {
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
   * @api {POST} /apis/v1/upload/qcloud/authcos COS上传授权
   * @apiDescription `Content-Type="application/json"`，COS客户端上传的授权,返回authorization.
   * @apiName authCOS
   * @apiGroup qcloud
   * @apiVersion 1.0.0
   * @apiParam {Object} header={}  Mandatory Header中内容.
   * @apiSuccess {Object} result of operation, {errcode=0,message,url}, errcode=0 when success, file is the dest filepath.
   * @apiError errcode!=0 error occurs.
   */
  async authCOS(ctx, next) {
    // debug('ctx1:', ctx.request.querystring);
    // debug('ctx2:', ctx.request.query);
    // debug('ctx3:', ctx.request.header);

    let {
      secretId,
      secretKey
    } = this.config;
    let options = { ...ctx.request.query, headers: ctx.request.header };
    let authorization = getAuthorizationCos(secretId, secretKey, options);
    debug('authorization cos:', authorization);
    ctx.body = { authorization, errcode: 0 };
  }
  /**
   * @api {POST} /apis/v1/upload/qcloud/authvod VOD上传授权
   * @apiDescription `Content-Type="application/json`，VOD客户端上传的授权,返回authorization.
   * @apiName authVOD
   * @apiGroup qcloud
   * @apiVersion 1.0.0
   * @apiSuccess {Object} result of operation, {errcode=0,message,url}, errcode=0 when success, file is the dest filepath.
   * @apiError errcode!=0 error occurs.
   */
  async authVOD(ctx, next) {
    let {
      secretId,
      secretKey
    } = this.config;
    let authorization = getAuthorizationVod(secretId, secretKey);
    debug('authorization vod:', authorization);
    ctx.body = { authorization, errcode: 0 };
  }
}
