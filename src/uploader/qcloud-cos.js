import _debug from 'debug';
const debug = _debug('app:qcloud-cos');
import crypto from 'crypto';

function camSafeUrlEncode(str) {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

function getParam(url, name) {
  let query,
    params = {},
    index = url.indexOf('?');
  if (index >= 0) {
    query = url.substr(index + 1).split('&');
    query.forEach(function(v) {
      let arr = v.split('=');
      params[arr[0]] = arr[1];
    });
  }
  return params[name];
}

// 工具方法
const getObjectKeys = obj => {
  let list = [];
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      list.push(key);
    }
  }
  return list.sort();
};

const obj2str = obj => {
  let i, key, val;
  let list = [];
  let keyList = getObjectKeys(obj);
  for (i = 0; i < keyList.length; i++) {
    key = keyList[i];
    val = obj[key] || '';
    key = key.toLowerCase();
    list.push(camSafeUrlEncode(key) + '=' + camSafeUrlEncode(val));
  }
  return list.join('&');
};

export const getAuthorization = (
  secretId,
  secretKey,
  headers,
  query = { pathname: '/', method: 'get', expire: 600 }
) => {
  if (!secretId || !secretKey) {
    throw new Error('secretId or secretKey not set!');
  }
  let pathname =
    (query && query.pathname && decodeURIComponent(query.pathname)) || '/';
  let method = (query && query.method) || 'get';
  let queryParams = {};
  let expire = (query && query.expire) || 600;

  headers = {};
  pathname.indexOf('/') !== 0 && (pathname = '/' + pathname);
  method = method.toLowerCase();

  // 签名有效起止时间
  let now = parseInt(new Date().getTime() / 1000) - 1;
  let expired = now + parseInt(expire); // 签名过期时刻，600 秒后

  // 要用到的 Authorization 参数列表
  let qSignAlgorithm = 'sha1';
  let qAk = secretId;
  let qSignTime = now + ';' + expired;
  let qKeyTime = now + ';' + expired;
  let qHeaderList = getObjectKeys(headers)
    .join(';')
    .toLowerCase();
  let qUrlParamList = getObjectKeys(queryParams)
    .join(';')
    .toLowerCase();

  // 签名算法说明文档：https://www.qcloud.com/document/product/436/7778
  // 步骤一：计算 SignKey
  let signKey = crypto
    .createHmac('sha1', secretKey)
    .update(qKeyTime)
    .digest('hex');

  // 步骤二：构成 FormatString
  let formatString = [
    method.toLowerCase(),
    pathname,
    obj2str(queryParams),
    obj2str(headers),
    ''
  ].join('\n');

  // 步骤三：计算 StringToSign
  let stringToSign = [
    'sha1',
    qSignTime,
    crypto
      .createHash('sha1')
      .update(formatString)
      .digest('hex'),
    ''
  ].join('\n');

  // 步骤四：计算 Signature
  let qSignature = crypto
    .createHmac('sha1', signKey)
    .update(stringToSign)
    .digest('hex');

  // 步骤五：构造 Authorization
  let authorization = [
    'q-sign-algorithm=' + qSignAlgorithm,
    'q-ak=' + qAk,
    'q-sign-time=' + qSignTime,
    'q-key-time=' + qKeyTime,
    'q-header-list=' + qHeaderList,
    'q-url-param-list=' + qUrlParamList,
    'q-signature=' + qSignature
  ].join('&');

  return authorization;
};

export default getAuthorization;
