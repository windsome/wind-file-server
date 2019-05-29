import _debug from 'debug';
const debug = _debug('app:api-chunked');

const path = require('path');
const parse = require('async-busboy');
const fs = require('fs');
const mkdirp = require('mkdirp');
import Errcode, { EC, EM } from '../Errcode';
import { _hash, _write, findFile } from './_utils';
import { beautifyFilename, fieldDatetime } from './_filename';

export default class Uploader {
  constructor(app, cfg) {
    // save opts.
    this.app = app;
    this.cfg = cfg;
    this.uploads = cfg && cfg.folder;
    this.tmps = this.uploads + '/tmp';
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
   *  name:"test.jpg" // 文件名称.
   *  size:12352  // 文件大小.
   *  hash:"xxxxxxx" // 文件hash值.如果不填则不检查文件hash是否存在.
   * }
   * @apiSuccessExample {json} 已上传过的文件,直接返回url:
   * HTTP/1.1 200 OK
   * {
   *  errcode: 0,
   *  message: 'ok',
   *  status:'finish', // 状态. finish表示已经上传过,ready表示等待上传.
   *  url: '/uploads/' + destname // 上传后文件链接地址
   * }
   * @apiSuccessExample {json} 未上传过,已准备好接收数据开始上传:
   * HTTP/1.1 200 OK
   * {
   *  errcode: 0,
   *  message: 'ok',
   *  status:'ready', // 状态. finish表示已经上传过,ready表示等待上传.
   *  destname, // 上传时的中间文件名称,会放在/uploads/tmp目录,上传完成后在文件名中添加hash并移动到/uploads目录.
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

    // let cmd = fields.cmd;
    let name = fields.name;
    let size = parseInt(fields.size) || 0;
    let hash = fields.hash || '';
    if (hash.length >= 16) {
      // 哈希值大于16个字节,我们认为其有效.
      // 去查找是否存在相同哈希及相同大小的文件
      // 如果存在,则返回此文件,不再上传.
      let findfile = findFile(this.uploads, hash + '.' + size);
      if (findfile) {
        // 找到文件.
        ctx.status = 200;
        ctx.body = {
          errcode,
          status: 'finish',
          message: 'ok',
          url: '/uploads/' + findfile
        };
        return;
      }
    }

    let basename = beautifyFilename(name).slice(-11);
    let intername = fieldDatetime() + '.' + size + '.' + basename; // 中间文件名字.

    ctx.status = 200;
    ctx.body = {
      errcode: 0,
      message: 'ok',
      status: 'ready',
      destname: intername
      // url: '/uploads/' + destname
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
   *  //cmd:"upload"  // 命令名称
   *  //name:"test.jpg" // 文件名称.
   *  //size:1235234534  // 文件大小.
   *  //hash:"xxxxxxx" // 文件hash值.
   *  destname:"xxxxxxtest.jpg" // 必须,服务器端中间文件名称,由start命令返回.在/uploads/tmp/下
   *  start:0 // 当前块在文件中的开始位置.
   *  //end:11562323 // 当前块在文件中的结束位置,可直接用buffer长度替换此end位置.
   * }
   * @apiSuccessExample {json} 成功响应:
   * HTTP/1.1 200 OK
   * {
   *  errcode: 0,
   *  message: 'ok',
   *  destname, // 上传后文件名称
   *  //url: '/uploads/' + destname // 上传后文件链接地址
   *  //tmp: '/uploads/tmps/' + destname,
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

    // Parse request for multipart
    const { files, fields } = await parse(ctx.req);

    // debug('uploadChunked:', { fields, files });
    let file = files[0];

    // let cmd = fields.cmd;
    // let name = fields.name;
    // let size = parseInt(fields.size) || 0;
    // let hash = fields.hash;
    let intername = fields.destname;
    let start = parseInt(fields.start) || 0;
    // let end = parseInt(fields.end) || 0;

    const filepath = path.join(this.tmps, intername);
    let flags = 'r+';
    if (!fs.existsSync(filepath)) {
      flags = 'w+';
      debug('create ', filepath);
    }
    let serverfile = await _write(filepath, file, start, flags);
    //ctx.res.setHeader("Content-Type", "application/json")
    // message = 'ok';
    ctx.status = 200;
    ctx.body = {
      errcode: 0,
      message: 'ok',
      destname: intername
      // url: '/uploads/' + destname,
      // tmp: '/uploads/tmps/' + destname
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
   *  //cmd:"end"  // 命令名称
   *  name:"test.jpg" // 文件名称.
   *  size:1235234534  // 文件大小.
   *  hash:"xxxxxxx" // 文件hash值.
   *  destname:"xxxxxxtest.jpg" // 服务器端中间文件名称,由start命令返回.在/uploads/tmp下
   * }
   * @apiSuccessExample {json} 成功响应:
   * HTTP/1.1 200 OK
   * {
   *  errcode: 0,
   *  message: 'ok',
   *  url: '/uploads/' + destname // 上传后文件最终链接地址,
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
    // Parse request for multipart
    const { files, fields } = await parse(ctx.req);

    // let file = files[0];
    // let cmd = fields.cmd;
    let name = fields.name;
    let intername = fields.destname;
    let size = parseInt(fields.size) || 0;
    let hash = fields.hash;

    const filepath = path.join(this.tmps, intername);
    let hash2 = await _hash(filepath);
    let notCheckHash = !hash || hash === 'null' || hash === 'none';
    if (!notCheckHash) {
      if (hash != hash2) {
        debug('error! hash mismatch! delete? hash=' + hash + ',cal=' + hash2);
        throw new Error('hash mismatch!');
      }
    }

    let basename = beautifyFilename(name).slice(-11);
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
    return;
  };
}
