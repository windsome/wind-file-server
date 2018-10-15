import _debug from 'debug';
const debug = _debug('app:api-form');

const parse = require('async-busboy');
import Errcode, { EC } from '../Errcode';
import { _genFileName, _put } from './_utils';

export default class Uploader {
  constructor(router, cfg) {
    // save opts.
    this.router = router;
    this.cfg = cfg;
    this.uploads = cfg && cfg.folder;

    // init router for apis.
    this.registerServices();
  }

  registerServices() {
    this.router.post('/form', this.uploadForm);
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
