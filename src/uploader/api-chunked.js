import _debug from 'debug';
const debug = _debug('app:api-chunked');

const uuid = require('uuid');
const path = require('path');
const parse = require('async-busboy');
const dateformat = require('dateformat');
const fs = require('fs');
const mkdirp = require('mkdirp');
import Errcode, { EC, EM } from '../Errcode';
import { _hash, _write } from './_utils';

export default class Uploader {
  constructor(app, cfg) {
    // save opts.
    this.app = app;
    this.cfg = cfg;
    this.uploads = cfg && cfg.folder;
    this.tmps = this.uploads+'/tmp';
    debug('init uploader! temps in ', this.tmps);
    if (!fs.existsSync(this.tmps)) mkdirp.sync(this.tmps);

    this.registerServices();
  }

  registerServices() {
    let prefix = '/apis/v1/upload/chunked';
    let router = require('koa-router')({ prefix });
    router.post('/start', this.start);
    router.post('/upload', this.uploadChunked);
    router.post('/end', this.end);

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
   * @api {POST} /apis/v1/upload/chunked/start 分块上传文件初始化
   * @apiDescription `Content-Type="multipart/*"`，XMLHttpRequest方式,开始上传的准备工作,判断文件是否存在.
   * 目标文件名为：hash.size.filename<br/>
   * 如果hash不存在，则用yyyymmddHHMMss_uuid.v4()来代替hash部分<br/>
   * @apiName chunkUploadStart
   * @apiGroup apiChunked
   * @apiVersion 1.0.0
   * @apiParamExample {json} 请求参数:
   * {
   *  cmd:"start"  // 命令名称
   *  name:"test.jpg" // 文件名称.
   *  size:12352  // 文件大小.
   *  hash:"xxxxxxx" // 文件hash值.
   * }
   * @apiSuccessExample {json} 成功响应:
   * HTTP/1.1 200 OK
   * {
   *  errcode: 0,
   *  message: 'ok',
   *  status:'ready/finish', // 状态. finish表示已经上传过,ready表示等待上传.
   *  destname, // 上传后文件名称
   *  url: '/uploads/' + destname // 上传后文件链接地址
   * }
   * @apiErrorExample {json} 错误例子:
   * {
   *  errcode: !=0, //ERR_NOT_MULTPART
   *  message: '错误消息'
   * }
   */
  start = async (ctx, next) => {
    // Validate Request
    if (!ctx.request.is('multipart/*')) {
      throw new Errcode('error! not multipart/*', EC.ERR_NOT_MULTPART);
    }

    // Parse request for multipart
    const { files, fields } = await parse(ctx.req);

    let cmd = fields.cmd;
    let name = fields.name;
    let size = parseInt(fields.size) || 0;
    let hash = fields.hash;
    let defName = dateformat(new Date(), 'yyyymmddHHMMss') + '_' + uuid.v4();

    let nName =
      (name &&
        name.replace(
          /(\/)|(\\)|(\*)|(\ )|(\')|(\")|(\:)|(\&)|(\n)|(\r)|(\t)|(\f)|(\[)|(\])|(\{)|(\})|(\()|(\))/g,
          '_'
        )) ||
      '';
    let destname = (hash || defName) + '.' + size + '.' + nName;

    let isFinish = false;
    let isUploading = false;

    const destpath = path.join(this.uploads, destname);
    if (fs.existsSync(destpath)) {
      isFinish = true;
    }
    const temppath = path.join(this.tmps, destname);
    if (fs.existsSync(temppath)) {
      isUploading = true;
    }
    let status = '';
    if (isFinish) status = 'finish';
    else status = 'ready';

    debug('upload start:', {
      cmd,
      name,
      size,
      hash,
      nName,
      destname,
      isFinish,
      isUploading
    });
    ctx.status = 200;
    ctx.body = {
      errcode: 0,
      message: 'ok',
      status,
      destname,
      url: '/uploads/' + destname
    };
    return;
  };

  /**
   * @api {POST} /apis/v1/upload/chunked/upload 分块上传文件块
   * @apiDescription `Content-Type="multipart/*"`，XMLHttpRequest方式,分块上传文件.
   * @apiName chunkUpload
   * @apiGroup apiChunked
   * @apiVersion 1.0.0
   * @apiParamExample {json} 请求参数:
   * {
   *  cmd:"upload"  // 命令名称
   *  name:"test.jpg" // 文件名称.
   *  size:1235234534  // 文件大小.
   *  hash:"xxxxxxx" // 文件hash值.
   *  destname:"xxxxxxtest.jpg" // 服务器端文件名称,由start命令返回.
   *  start:0 // 当前块在文件中的开始位置.
   *  end:11562323 // 当前块在文件中的结束位置
   * }
   * @apiSuccessExample {json} 成功响应:
   * HTTP/1.1 200 OK
   * {
   *  errcode: 0,
   *  message: 'ok',
   *  destname, // 上传后文件名称
   *  url: '/uploads/' + destname // 上传后文件链接地址
   *  tmp: '/uploads/tmps/' + destname,
   * }
   * @apiErrorExample {json} 错误例子:
   * {
   *  errcode: !=0, //ERR_NOT_MULTPART
   *  message: '错误消息'
   * }
   */
  uploadChunked = async (ctx, next) => {
    // Validate Request
    if (!ctx.request.is('multipart/*')) {
      throw new Errcode('error! not multipart/*', EC.ERR_NOT_MULTPART);
    }
    let message = '';
    let errcode = 0;

    // Parse request for multipart
    const { files, fields } = await parse(ctx.req);

    // debug('uploadChunked:', { fields, files });
    let file = files[0];

    let cmd = fields.cmd;
    let name = fields.name;
    let destname = fields.destname;
    let size = parseInt(fields.size) || 0;
    let hash = fields.hash;
    let start = parseInt(fields.start) || 0;
    let end = parseInt(fields.end) || 0;

    const filepath = path.join(this.tmps, destname);
    let flags = 'r+';
    if (!fs.existsSync(filepath)) {
      flags = 'w+';
      debug('create ', filepath);
    }
    let serverfile = await _write(filepath, file, start, flags);
    //ctx.res.setHeader("Content-Type", "application/json")
    message = 'ok';
    ctx.status = 200;
    ctx.body = {
      errcode,
      message,
      destname,
      url: '/uploads/' + destname,
      tmp: '/uploads/tmps/' + destname
    };
    return;
  };

  /**
   * @api {POST} /apis/v1/upload/chunked/end 分块上传文件完成
   * @apiDescription `Content-Type="multipart/*"`，XMLHttpRequest方式,分块上传文件完成后的收尾处理,并返回url.
   * @apiName chunkUploadEnd
   * @apiGroup apiChunked
   * @apiVersion 1.0.0
   * @apiParamExample {json} 请求参数:
   * {
   *  cmd:"end"  // 命令名称
   *  name:"test.jpg" // 文件名称.
   *  size:1235234534  // 文件大小.
   *  hash:"xxxxxxx" // 文件hash值.
   *  destname:"xxxxxxtest.jpg" // 服务器端文件名称,由start命令返回.
   * }
   * @apiSuccessExample {json} 成功响应:
   * HTTP/1.1 200 OK
   * {
   *  errcode: 0,
   *  message: 'ok',
   *  url: '/uploads/' + destname // 上传后文件链接地址
   * }
   * @apiErrorExample {json} 错误例子:
   * {
   *  errcode: !=0, //ERR_NOT_MULTPART
   *  message: '错误消息'
   * }
   */
  end = async (ctx, next) => {
    // Validate Request
    if (!ctx.request.is('multipart/*')) {
      throw new Errcode('error! not multipart/*', EC.ERR_NOT_MULTPART);
    }
    let message = '';
    let errcode = 0;

    // Parse request for multipart
    const { files, fields } = await parse(ctx.req);

    let file = files[0];

    let cmd = fields.cmd;
    let name = fields.name;
    let destname = fields.destname;
    let size = parseInt(fields.size) || 0;
    let hash = fields.hash;

    const filepath = path.join(this.tmps, destname);
    message = 'ok';
    let notCheckHash = !hash || hash === 'null' || hash === 'none';
    if (!notCheckHash) {
      let hash2 = await _hash(filepath);
      if (hash != hash2) {
        debug('error! hash mismatch! delete? hash=' + hash + ',cal=' + hash2);
        throw new Error('hash mismatch!');
      }
    }
    fs.renameSync(
      path.join(this.tmps, destname),
      path.join(this.uploads, destname)
    );
    ctx.status = 200;
    ctx.body = {
      errcode,
      message,
      url: '/uploads/' + destname
    };
    return;
  };
}
