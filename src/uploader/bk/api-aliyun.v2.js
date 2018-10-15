import _debug from 'debug';
const debug = _debug('app:api-aliyun');

import { sts } from 'apis-aliyun';
import * as vod from './aliyun-vod.v2';
import Errcode, { EC, EM } from '../Errcode';

export default class Uploader {
  constructor(app, config) {
    // save opts.
    this.app = app;
    this.config = config;
    debug('init uploader! aliyun!');

    this.AssumeRole = this.AssumeRole.bind(this);
    this.GetPlayInfo = this.GetPlayInfo.bind(this);

    // init router for apis.
    this.registerServices();
  }

  registerServices() {
    let prefix = '/apis/v1/upload/aliyun';
    let router = require('koa-router')({ prefix });

    router.get('/AssumeRole', this.AssumeRole);
    router.get('/GetPlayInfo/:VideoId', this.GetPlayInfo);

    this.app.use(async (ctx, next) => {
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
   * @api {GET} /apis/v1/upload/aliyun/AssumeRole AssumeRole上传前获取临时凭据
   * @apiDescription 阿里云上传文件前获取sts临时凭据
   * @apiName AssumeRole
   * @apiGroup aliyun
   * @apiVersion 1.0.0
   * @apiSuccess {Object} result of operation, {errcode=0,message,url}, errcode=0 when success, file is the dest filepath.
   * @apiError errcode!=0 error occurs.
   */
  async AssumeRole(ctx, next) {
    let { AccessKeyId, AccessKeySecret, RoleArn } = this.config;
    let result = await sts.AssumeRole({
      AccessKeyId,
      AccessKeySecret,
      RoleArn,
      RoleSessionName: 'windsome1'
    });
    ctx.body = result;
  }

  /**
   * @api {GET} /apis/v1/upload/aliyun/GetPlayInfo/:VideoId 获取视频信息
   * @apiDescription 获取视频信息
   * @apiName GetPlayInfo
   * @apiGroup aliyun
   * @apiVersion 1.0.0
   * @apiParam {String} VideoId=2e3048c823584b8b81e14b2ccfa4f52e  Mandatory 视频ID.
   * @apiSuccess {Object} result of operation, {errcode=0,message,url}, errcode=0 when success, file is the dest filepath.
   * @apiError errcode!=0 error occurs.
   */
  async GetPlayInfo(ctx, next) {
    let VideoId = ctx.params.VideoId; //2e3048c823584b8b81e14b2ccfa4f52e
    let { AccessKeyId, AccessKeySecret } = this.config;

    let result = await vod.GetPlayInfo({
      AccessKeyId,
      AccessKeySecret,
      VideoId
    });
    ctx.body = result;
  }
}
