import _debug from 'debug';
const debug = _debug('app:api-local-server:v2');

const uuid = require('uuid');
const path = require('path');
const parse = require('async-busboy');
const dateformat = require('dateformat');
const fs = require('fs');
const mkdirp = require('mkdirp');
const getRawBody = require('raw-body');
const contentType = require('content-type');
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

    this.uploadBase64 = this.uploadBase64.bind(this);
    this.uploadForm = this.uploadForm.bind(this);
    this.uploadChunked = this.uploadChunked.bind(this);

    // init router for apis.
    this.registerServices();
  }

  registerServices() {
    let prefix = '/apis/v1/upload/local';
    let router = require('koa-router')({ prefix });
    //v2
    router.post('/base64/:filename', this.uploadBase64);
    router.post('/form', this.uploadForm);
    router.post('/chunk', this.uploadChunked);

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
  async uploadBase64(ctx, next) {
    //console.log (ctx.req);
    var filename = ctx.params.filename;
    var charset = 'utf-8';
    try {
      charset = contentType.parse(ctx.req).parameters.charset;
      //console.log ("get charset", charset);
    } catch (e) {
      console.log('parse charset error!', e);
      charset = 'utf-8';
    }
    var rawText = await getRawBody(ctx.req, {
      encoding: charset
    });
    var destfile = this._genFileName(filename);

    // get image base64 data.
    var pos1 = rawText.indexOf(';base64,');
    if (pos1 < 0) {
      ctx.body = { errcode: -1, message: 'image content wrong!' };
      return;
    }
    pos1 = pos1 + ';base64,'.length;
    var base64_data = rawText.substr(pos1);
    // // care!!! regular match() expend too much time, change to indexOf().
    // var matches = rawText.match(/^data:.+\/(.+);base64,(.*)$/);
    // var ext = matches[1];
    // var base64_data = matches[2];
    var buffer = new Buffer(base64_data, 'base64');

    const filepath = path.join(this.uploads, destfile);
    fs.writeFileSync(filepath, buffer);
    ctx.body = { errcode: 0, file: destfile };

    /*
        var data_url = req.body.file;
        var matches = data_url.match(/^data:.+\/(.+);base64,(.*)$/);
        var ext = matches[1];
        var base64_data = matches[2];
        var buffer = new Buffer(base64_data, 'base64');

        fs.writeFile(__dirname + '/media/file', buffer, function (err) {
            res.send('success');
        });
        var filename = ctx.params.filename;
        ctx.body = { errcode:0, filename: filename };
*/
    return;
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
  async uploadForm(ctx, next) {
    // Validate Request
    if (!ctx.request.is('multipart/*')) {
      throw new Errcode('error! not multipart/*', EC.ERR_NOT_MULTPART);
    }

    // Parse request for multipart
    const { files, fields } = await parse(ctx.req);

    // Generate oss path
    let result = {};
    files.forEach(file => {
      result[file.filename] = this._genFileName(file.filename);
    });

    // Upload to OSS or folders
    try {
      await Promise.all(
        files.map(file => {
          return this._put(this.uploads, result[file.filename], file);
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
    // // Return result
    // ctx.status = 200
    // // Support < IE 10 browser
    // ctx.res.setHeader("Content-Type", "text/html")
    // ctx.body = JSON.stringify(store.get(result))
    return;
  }

  /**
   * @api {POST} /apis/v1/upload/chunked 分块上传文件
   * @apiDescription `Content-Type="multipart/*"`，使用ajax分块上传大文件.
   * @apiName uploadChunked
   * @apiGroup LocalServerV2
   * @apiVersion 1.0.0
   * @apiParam {String} filename="test.jpg"  Mandatory 保存的文件名.
   * @apiParam {String} hash="xxxxxx"  Mandatory 文件哈希值.
   * @apiParam {String} count=5  Mandatory 总块数.
   * @apiParam {String} current=0  Mandatory 当前块.
   * @apiParam {String} chunkSize=0  Mandatory 块大小.
   * @apiParam {String} start=0  Mandatory 开始位置.
   * @apiParam {String} end=0  Mandatory 结束位置.
   * @apiSuccess {Object} result of operation, {errcode=0,file}, errcode=0 when success, file is the dest filepath.
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

    var file = files[0];

    var name = fields.name || file.filename;
    var hash = fields.hash || 'none';
    var count = parseInt(fields.count);
    var current = parseInt(fields.current);
    var size = parseInt(fields.size) || 0;
    var chunkSize = parseInt(fields.chunkSize);
    var start = parseInt(fields.start) || 0;
    var end = parseInt(fields.end) || 0;

    var nName =
      (name &&
        name.replace(
          /(\/)|(\\)|(\*)|(\ )|(\')|(\")|(\:)|(\&)|(\n)|(\r)|(\t)|(\f)|(\[)|(\])|(\{)|(\})|(\()|(\))/g,
          '_'
        )) ||
      '';
    debug('uploadChunked:', fields, ', oName:', name, 'nName:', nName);
    var destname = hash + '.' + size + '.' + nName;
    const filepath = path.join(this.uploads, destname);
    var flags = 'r+';
    if (!fs.existsSync(filepath)) {
      flags = 'w+';
      debug('create ', filepath);
    }
    //debug ("file:",file);
    var serverfile = await this._write(filepath, file, start, flags);
    //ctx.res.setHeader("Content-Type", "application/json")
    if (current == count - 1) {
      // finish. combine files.
      message = 'ok';
      debug('end of receiving file! hash=' + hash);
      let notCheckHash = !hash || hash === 'null' || hash === 'none';
      if (!notCheckHash) {
        debug('receive hash! checking hash!');

        var hash2 = await this._hash(filepath);
        if (hash != hash2) {
          message = 'hash mismatch!';
          errcode = 1;
          debug(
            'error! hash mismatch! delete file? hash=' + hash + ',cal=' + hash2
          );
        } else {
          debug('hash ok!');
        }
      }
    }
    ctx.status = 200;
    ctx.body = {
      errcode,
      message,
      url: '/uploads/' + destname,
      current,
      count
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
        return reject(null);
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
