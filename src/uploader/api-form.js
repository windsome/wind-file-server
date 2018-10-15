import _debug from 'debug';
const debug = _debug('app:api-form');

const parse = require('async-busboy');
import Errcode, { EC, EM } from '../Errcode';
import { _genFileName, _put } from './_utils';

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
    let prefix = '/apis/v1/upload/form';
    let router = require('koa-router')({ prefix });
    router.post('/', this.uploadForm);

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
   * @api {POST} /apis/v1/upload/form 表单方式上传文件
   * @apiDescription `Content-Type="multipart/form-data"`，form表单数据,适合图片文件,不超过2M.
   * @apiName uploadForm
   * @apiGroup LocalServerV2
   * @apiVersion 1.0.0
   * @apiParam {String} filename="test.jpg"  Mandatory 保存的文件名.
   * @apiSuccess {Object} result of operation, {errcode=0,file}, errcode=0 when success, file is the dest filepath.
   * @apiError errcode!=0 error occurs.
   */
  uploadForm = async (ctx, next) => {
    // Validate Request
    if (!ctx.request.is('multipart/*')) {
      throw new Errcode('error! not multipart/*', EC.ERR_NOT_MULTPART);
    }

    // Parse request for multipart
    const { files, fields } = await parse(ctx.req);

    // Generate oss path
    let result = {};
    files.forEach(file => {
      result[file.filename] = _genFileName(file.filename);
    });

    // Upload to OSS or folders
    try {
      await Promise.all(
        files.map(file => {
          return _put(this.uploads, result[file.filename], file);
        })
      );
    } catch (err) {
      ctx.status = 500;
      //ctx.body = `Error: ${err}`
      ctx.body = { errcode: -1, message: err.message };
      return;
    }
    //ctx.res.setHeader("Content-Type", "application/json")
    ctx.status = 200;
    ctx.body = { errcode: 0, files: result };
    return;
  };
}
