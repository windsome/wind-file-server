import _debug from 'debug';
const debug = _debug('app:_utils');

const uuid = require('uuid');
const path = require('path');
const dateformat = require('dateformat');
const fs = require('fs');
const mkdirp = require('mkdirp');
const crypto = require('crypto');
const http = require('http');
const request = require('request');

export const _hash = filepath => {
  return new Promise((resolve, reject) => {
    let start = new Date().getTime();
    let md5sum = crypto.createHash('md5');
    let stream = fs.createReadStream(filepath);
    stream.on('data', function(chunk) {
      md5sum.update(chunk);
    });
    stream.on('error', () => {
      reject(false);
    });
    stream.on('end', () => {
      let str = md5sum.digest('hex').toUpperCase();
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
};

export const _write = (filepath, file, start, flags) => {
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
};

export const _put = (folder, filename, file) => {
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
};

export const _genFileName = filename => {
  let destfile = `${path.basename(
    filename,
    path.extname(filename)
  )}.${dateformat(new Date(), 'yyyymmddHHMMss')}-${uuid.v4()}${path.extname(
    filename
  )}`;
  return destfile;
};

export const findFile = (path, partname) => {
  let dirList = fs.readdirSync(path);
  for (let i = 0; i < dirList.length; i++) {
    let item = dirList[i];
    if (item.indexOf(partname) >= 0) {
      // find the file.
      return item;
    }
  }
  return null;
};

export function downloadFile(sourceUrl, targetPath) {
  return new Promise((resolve, reject) => {
    let writeStream = fs.createWriteStream(targetPath);
    let readStream = request(sourceUrl);
    readStream.pipe(writeStream);
    readStream.on('error', err => {
      writeStream.end();
      reject(err);
    });

    readStream.on('end', () => {
      writeStream.end();
      resolve(true);
    });
  });
}

export function downloadFile2(sourceUrl, targetPath) {
  return new Promise((resolve, reject) => {
    http.get(sourceUrl, res => {
      let fileData = '';
      res.setEncoding('binary');
      res.on('data', function(chunk) {
        fileData += chunk;
      });
      res.on('end', function() {
        fs.writeFile(targetPath, fileData, 'binary', function(err) {
          if (err) reject(err);
          else resolve(true);
        });
      });
    });
  });
}
