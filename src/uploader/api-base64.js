import _debug from 'debug';
const debug = _debug('app:api-base64');

const path = require('path');
const fs = require('fs');
const getRawBody = require('raw-body');
const contentType = require('content-type');
import Errcode, { EC, EM } from '../Errcode';
import { _genFileName } from './_utils';

export default class Uploader {
  constructor(app, cfg) {
    // save opts.
    this.app = app;
    this.cfg = cfg;
    this.uploads = cfg && cfg.folder;

    // init router for apis.
    this.registerServices();
  }

  registerServices() {
    let prefix = '/apis/v1/upload/base64';
    let router = require('koa-router')({ prefix });
    router.post('/:filename', this.uploadBase64);

    this.app.use(async (ctx, next) => {
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
   * @api {POST} /apis/v1/upload/base64/:filename 上传base64编码文件
   * @apiDescription `Content-Type="text/html"`，body中是base64编码的数据,数据量是原文件两倍.
   * @apiName uploadBase64
   * @apiGroup LocalServerV2
   * @apiVersion 1.0.0
   * @apiParam {String} filename="test.jpg"  Mandatory 保存的文件名.
   * @apiParamExample {text} Request-Example:
   * <img src='data:img/jpg;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVQI12N8xcTEwMDAxMDAwMDAAAAMOgDyUlsUlAAAAABJRU5ErkJggg=='/>
   * @apiSuccess {Object} result of operation, {errcode=0,file}, errcode=0 when success, file is the dest filepath.
   * @apiError errcode!=0 error occurs.
   */
  uploadBase64 = async (ctx, next) => {
    //debug (ctx.req);
    let filename = ctx.params.filename;
    let charset = 'utf-8';
    try {
      charset = contentType.parse(ctx.req).parameters.charset;
      //debug ("get charset", charset);
    } catch (e) {
      debug('parse charset error!', e);
      charset = 'utf-8';
    }
    let rawText = await getRawBody(ctx.req, {
      encoding: charset
    });
    let destfile = _genFileName(filename);

    // get image base64 data.
    let pos1 = rawText.indexOf(';base64,');
    if (pos1 < 0) {
      ctx.body = { errcode: -1, message: 'image content wrong!' };
      return;
    }
    pos1 = pos1 + ';base64,'.length;
    let base64_data = rawText.substr(pos1);
    // // care!!! regular match() expend too much time, change to indexOf().
    // let matches = rawText.match(/^data:.+\/(.+);base64,(.*)$/);
    // let ext = matches[1];
    // let base64_data = matches[2];
    let buffer = new Buffer(base64_data, 'base64');

    const filepath = path.join(this.uploads, destfile);
    fs.writeFileSync(filepath, buffer);
    ctx.body = { errcode: 0, file: destfile };

    return;
  };
}
