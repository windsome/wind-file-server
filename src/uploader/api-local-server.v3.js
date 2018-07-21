import _debug from 'debug';
const debug = _debug('app:api-local-server:v3');

const uuid = require('uuid');
const path = require('path');
const parse = require('async-busboy');
const dateformat = require('dateformat');
const fs = require('fs');
const mkdirp = require('mkdirp');
const crypto = require('crypto');
import Errcode, { EC, EM } from '../Errcode';

export default class Uploader {
  constructor(app) {
    // save opts.
    this.app = app;
    this.uploads =
      process.env.UPLOAD_FOLDER || path.join(process.cwd(), 'uploads');
    debug('init uploader! uploads in ', this.uploads);
    if (!fs.existsSync(this.uploads)) mkdirp.sync(this.uploads);

    this.start = this.start.bind(this);
    this.uploadChunked = this.uploadChunked.bind(this);
    this.end = this.end.bind(this);

    this.registerServices();
  }

  registerServices() {
    let prefix = '/apis/v3/upload/local';
    let router = require('koa-router')({ prefix });
    //v3
    router.post('/start', this.start);
    router.post('/upload', this.uploadChunked);
    router.post('/end', this.end);

    this.app.use(async (ctx, next) => {
      if (ctx.path.startsWith(prefix)) {
        try {
          debug('path:', ctx.path, prefix);
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
   * @api {POST} /apis/v3/upload/local/start 分块上传文件初始化
   * @apiDescription `Content-Type="multipart/*"`，开始上传的准备工作,判断文件是否存在.
   * 目标文件名为：hash.size.filename<br/>
   * 如果hash不存在，则用yyyymmddHHMMss_uuid.v4()来代替hash部分<br/>
   * @apiName chunkUploadStart
   * @apiGroup LocalServerV3
   * @apiVersion 1.0.0
   * @apiParam {String} cmd="start"  Mandatory 命令.
   * @apiParam {String} name="test.jpg"  Mandatory 文件名称.
   * @apiParam {String} size=12352  Mandatory 文件大小.
   * @apiParam {String} hash="xxxxxxx"  Mandatory 文件hash值.
   * @apiSuccess {Object} result of operation, {errcode=0,message,status,destname,url}, errcode=0 when success, file is the dest filepath.
   * @apiError errcode!=0 error occurs.
   */
  async start(ctx, next) {
    // Validate Request
    if (!ctx.request.is('multipart/*')) {
      throw new Errcode('error! not multipart/*', EC.ERR_NOT_MULTPART);
    }

    // Parse request for multipart
    const { files, fields } = await parse(ctx.req);

    var cmd = fields.cmd;
    var name = fields.name;
    var size = parseInt(fields.size) || 0;
    var hash =
      fields.hash || dateformat(new Date(), 'yyyymmddHHMMss') + '_' + uuid.v4();

    var nName =
      (name &&
        name.replace(
          /(\/)|(\\)|(\*)|(\ )|(\')|(\")|(\:)|(\&)|(\n)|(\r)|(\t)|(\f)|(\[)|(\])|(\{)|(\})|(\()|(\))/g,
          '_'
        )) ||
      '';
    var destname = hash + '.' + size + '.' + nName;

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
  }

  /**
   * @api {POST} /apis/v3/upload/local/upload 分块上传文件块
   * @apiDescription `Content-Type="multipart/*"`，分块上传文件.
   * @apiName chunkUpload
   * @apiGroup LocalServerV3
   * @apiVersion 1.0.0
   * @apiParam {String} cmd="upload"  Mandatory 命令.
   * @apiParam {String} name="test.jpg"  Mandatory 文件名称.
   * @apiParam {String} destname="xxxxxxtest.jpg"  Mandatory 服务器端文件名称.
   * @apiParam {String} size=12352  Mandatory 文件大小.
   * @apiParam {String} hash="xxxxxxx"  Mandatory 文件hash值.
   * @apiParam {String} start=0  Mandatory 块在文件中的开始位置.
   * @apiParam {String} end=111  Mandatory 块在文件中的结束位置.
   * @apiSuccess {Object} result of operation, {errcode=0,message,destname,url,tmp,start,end}, errcode=0 when success, file is the dest filepath.
   * @apiError errcode!=0 error occurs.
   */
  async uploadChunked(ctx, next) {
    // Validate Request
    if (!ctx.request.is('multipart/*')) {
      throw new Errcode('error! not multipart/*', EC.ERR_NOT_MULTPART);
    }
    var message = '';
    var errcode = 0;

    // Parse request for multipart
    const { files, fields } = await parse(ctx.req);

    debug('uploadChunked:', { fields, files });
    var file = files[0];

    var cmd = fields.cmd;
    var name = fields.name;
    var destname = fields.destname;
    var size = parseInt(fields.size) || 0;
    var hash = fields.hash || 'none';
    var start = parseInt(fields.start) || 0;
    var end = parseInt(fields.end) || 0;

    const filepath = path.join(this.tmps, destname);
    var flags = 'r+';
    if (!fs.existsSync(filepath)) {
      flags = 'w+';
      debug('create ', filepath);
    }
    var serverfile = await this._write(filepath, file, start, flags);
    //ctx.res.setHeader("Content-Type", "application/json")
    ctx.status = 200;
    ctx.body = {
      errcode,
      message,
      destname,
      url: '/uploads/' + destname,
      tmp: '/uploads/tmps/' + destname,
      start,
      end
    };
    return;
  }

  /**
   * @api {POST} /apis/v3/upload/local/end 分块上传文件完成
   * @apiDescription `Content-Type="multipart/*"`，分块上传文件完成后的收尾处理,并返回url.
   * @apiName chunkUploadEnd
   * @apiGroup LocalServerV3
   * @apiVersion 1.0.0
   * @apiParam {String} cmd="end"  Mandatory 命令.
   * @apiParam {String} name="test.jpg"  Mandatory 文件名称.
   * @apiParam {String} destname="xxxxxxtest.jpg"  Mandatory 服务器端文件名称.
   * @apiParam {String} size=12352  Mandatory 文件大小.
   * @apiParam {String} hash="xxxxxxx"  Mandatory 文件hash值.
   * @apiSuccess {Object} result of operation, {errcode=0,message,url}, errcode=0 when success, file is the dest filepath.
   * @apiError errcode!=0 error occurs.
   */
  async end(ctx, next) {
    // Validate Request
    if (!ctx.request.is('multipart/*')) {
      throw new Errcode('error! not multipart/*', EC.ERR_NOT_MULTPART);
    }
    var message = '';
    var errcode = 0;

    // Parse request for multipart
    const { files, fields } = await parse(ctx.req);

    var file = files[0];

    var cmd = fields.cmd;
    var name = fields.name;
    var destname = fields.destname;
    var size = parseInt(fields.size) || 0;
    var hash = fields.hash;

    const filepath = path.join(this.tmps, destname);
    message = 'ok';
    let notCheckHash = !hash || hash === 'null' || hash === 'none';
    if (!notCheckHash) {
      var hash2 = await this._hash(filepath);
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
  }

  _hash(filepath) {
    return new Promise((resolve, reject) => {
      var start = new Date().getTime();
      var md5sum = crypto.createHash('md5');
      var stream = fs.createReadStream(filepath);
      stream.on('data', function(chunk) {
        md5sum.update(chunk);
      });
      stream.on('error', () => {
        reject(false);
      });
      stream.on('end', () => {
        var str = md5sum.digest('hex').toUpperCase();
        console.log(
          '文件:' +
            filepath +
            ',MD5签名为:' +
            str +
            '.耗时:' +
            (new Date().getTime() - start) / 1000.0 +
            '秒'
        );
        resolve(str);
      });
    });
  }
  _write(filepath, file, start, flags) {
    return new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(filepath, {
        flags: flags,
        start: start
      });
      file.pipe(stream);
      file.on('error', e => {
        debug('error:', e);
        return reject(e);
      });
      file.on('end', e => {
        //debug ("end:",start);
        stream.end();
      });
      stream.on('close', e => {
        //debug ("close:",e);
        return resolve(filepath);
      });
    });
  }
  _put(folder, filename, file) {
    return new Promise((resolve, reject) => {
      const filepath = path.join(folder, filename);
      mkdirp.sync(path.dirname(filepath));
      const stream = fs.createWriteStream(filepath);
      file.pipe(stream);
      file.on('end', () => {
        stream.end();
        return resolve(filename);
      });
    });
  }

  _genFileName(filename) {
    var destfile = `${path.basename(
      filename,
      path.extname(filename)
    )}.${dateformat(new Date(), 'yyyymmddHHMMss')}-${uuid.v4()}${path.extname(
      filename
    )}`;
    return destfile;
  }
}
