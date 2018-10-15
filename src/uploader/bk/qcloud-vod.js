import _debug from 'debug';
const debug = _debug('app:qcloud-vod');
import crypto from 'crypto';
import querystring from 'querystring';

export const getAuthorization = (secretId, secretKey, options) => {
  if (!secretId || !secretKey) {
    throw new Error('secretId or secretKey not set!');
  }

  let expire = (options && options.expire) || 86400;

  // 确定签名的当前时间和失效时间
  let current = parseInt(new Date().getTime() / 1000);
  let expired = current + expire; // 签名有效期：1天

  // 向参数列表填入参数
  let arg_list = {
    secretId,
    currentTimeStamp: current,
    expireTime: expired,
    random: Math.round(Math.random() * Math.pow(2, 32))
  };

  // 计算签名
  let orignal = querystring.stringify(arg_list);
  let orignal_buffer = new Buffer(orignal, 'utf8');

  let hmac = crypto.createHmac('sha1', secretKey);
  let hmac_buffer = hmac.update(orignal_buffer).digest();

  let signature = Buffer.concat([hmac_buffer, orignal_buffer]).toString(
    'base64'
  );

  return signature;
};

export default getAuthorization;
