import fs from 'fs';
import path from 'path';
import Errcode, { EC, EM } from '../Errcode';
import { downloadFile, _hash } from './_utils';
import { fieldDatetime, beautifyFilename } from './_filename';
import _debug from 'debug';
const debug = _debug('app:api-url');

export const urlFilename = (url = '/') => {
  if (!url) return null;
  let index = url.lastIndexOf('/');
  let filename = url.slice(index + 1);
  return filename;
};

export default class Uploader {
  constructor(app, cfg) {
    // save opts.
    // this.app = app;
    // this.cfg = cfg;
    // this.uploads = cfg && cfg.folder;

    this.app = app;
    this.cfg = cfg;
    this.uploads = cfg && cfg.folder;
    this.tmps = this.uploads + '/tmp';
    debug('init uploader! temps in ', this.tmps);
    if (!fs.existsSync(this.tmps)) mkdirp.sync(this.tmps);

    // init router for apis.
    this.registerServices();
  }

  registerServices() {
    let prefix = '/apis/v1/upload/url';
    let router = require('koa-router')({ prefix });
    router.all('/', this.uploadByUrl);

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
   * @api {POST} /apis/v1/upload/url 下载url对应的资源
   * @apiDescription form表单数据,适合图片文件,不超过2M.
   * @apiName uploadByUrl
   * @apiGroup LocalServerV2
   * @apiVersion 1.0.0
   * @apiParam {String} filename="test.jpg" 可选 保存的文件名.
   * @apiParam {String} url="http://xxxx/test.jpg" 必选 文件url
   * @apiSuccess {Object} result of operation, {errcode=0,file}, errcode=0 when success, file is the dest filepath.
   * @apiError errcode!=0 error occurs.
   */
  uploadByUrl = async (ctx, next) => {
    let args = { ...ctx.request.query, ...ctx.request.body };
    let { filename, url } = args;
    // debug('uploadByUrl',ctx.request.query, ctx.request.body, args, filename, url );
    if (!url) {
      throw new Errcode('error! no url', EC.ERR_NO_URL);
    }

    let name = urlFilename(filename || url);
    let basename = beautifyFilename(name).slice(-11);
    let intername = fieldDatetime() + '.' + basename; // 中间文件名字.
    const temppath = path.join(this.tmps, intername);
    try {
      let res = await downloadFile(url, temppath);
    } catch (error) {
      debug('error uploadByUrl!', error);
      throw new Errcode('error! download fail!', EC.ERR_DOWNLOAD_URL);
    }

    let hash2 = await _hash(temppath);
    let fsobj = fs.statSync(temppath);
    let size = (fsobj && fsobj.size) || 0;
    let destname = hash2 + '.' + size + '.' + basename; // 中间文件名字.

    fs.renameSync(
      path.join(this.tmps, intername),
      path.join(this.uploads, destname)
    );
    ctx.status = 200;
    ctx.body = {
      errcode: 0,
      message: 'ok',
      url: '/uploads/' + destname
    };
  };
}
