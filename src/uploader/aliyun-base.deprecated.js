import _debug from 'debug';
const debug = _debug('app:upload:aliyun');
import 'isomorphic-fetch';
import moment from 'moment';
import _ from 'lodash';
import crypto from 'crypto';
import uuid from 'uuid';

const _request = (url, opts = {}) => {
  //debug ("_request", url, opts);
  return fetch(url, { ...opts, credentials: 'include' })
    .then(data => data.json())
    .then(retobj => {
      if (!retobj) {
        throw new Error('error! get null from ' + url);
      }
      debug('request:', url, ', result:', retobj);
      return retobj;
    });
};

const _get = url => {
  var opts = {
    //dataType: 'json',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }
  };
  return _request(url, opts);
};

const _post = (url, data) => {
  var opts = {
    //dataType: 'json',
    method: 'POST',
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }
  };
  return _request(url, opts);
};

/**
 * 阿里云api通用参数，放置于URL中。见：https://help.aliyun.com/document_detail/44432.html?spm=a2c4g.11186623.2.7.xWsXiE
    名称      	类型	是否必选	描述
    Format	   String  	否	返回值的类型，支持JSON与XML，默认为XML。
    Version	   String  	是	API版本号，为日期形式：YYYY-MM-DD，本版本对应为2017-03-21。
    AccessKeyId	String	是	阿里云颁发给用户的访问服务所用的密钥ID。请参见账号权限概述。
    Signature	 String	  是	签名结果串，关于签名的计算方法，参见 API签名机制，代码示例参见 Signature。
    SignatureMethod	String	是	签名方式，目前支持HMAC-SHA1。
    Timestamp	 String	  是	请求的时间戳。
        日期格式按照ISO8601标准表示，并需要使用UTC时间。格式为：YYYY-MM-DDThh:mm:ssZ
        例如，2017-3-29T12:00:00Z 为北京时间2017年3月29日的20点0分0秒。代码示例参见 TimeStamp。
    SignatureVersion	String	是	签名算法版本，目前版本是1.0。
    SignatureNonce	String	是	唯一随机数，用于防止网络重放攻击。用户在不同请求间要使用不同的随机数值。代码示例参见 SignatureNonce。
    SecurityToken	String	否	STS临时授权的Token，默认为空。概念参见 账号权限 的 STS临时AK，生成方式参见 STS临时授权访问。
 * 用来生成URL：
    http://vod.cn-shanghai.aliyuncs.com/
    ?Format=json 
    &Version=2017-03-21
    &Signature=vpEEL0zFHfxXYzSFV0n7%2FZiFL9o%3D 
    &SignatureMethod=Hmac-SHA1
    &SignatureNonce=9166ab59-f445-4005-911d-664c1570df0f
    &SignatureVersion=1.0
    &Action=GetVideoPlayAuth
    &AccessKeyId=tkHh5O7431CgWayx  
    &Timestamp=2017-03-29T09%3A22%3A32Z
 * @param {object} args 
 */
const _genCommonArgs = ({ Action, AccessKeyId, Version }) => {
  if (!Action || !AccessKeyId || !Version) {
    throw new Error(
      'missing parameters:Action=' +
        Action +
        ', AccessKeyId=' +
        AccessKeyId +
        ', Version=' +
        Version
    );
  }
  //let Timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
  let Timestamp = moment()
    .utc()
    .format('YYYY-MM-DD HH:mm:ss');
  let SignatureNonce = uuid.v4();
  return {
    Format: 'JSON',
    Version,
    Action,
    AccessKeyId,
    SignatureMethod: 'HMAC-SHA1',
    Timestamp,
    SignatureVersion: '1.0',
    SignatureNonce
  };
};

const _sign = (args, { AccessKeySecret }) => {
  if (!args || !AccessKeySecret) {
    throw new Error(
      'missing parameters:args=' +
        JSON.stringify(args) +
        ', AccessKeySecret=' +
        AccessKeySecret
    );
  }
  let nArgs = { ...args };
  let arr = Object.keys(nArgs).sort();
  // update nArgs if exist object.
  arr.map(key => {
    if (typeof nArgs[key] === 'object') {
      nArgs[key] = JSON.stringify(nArgs[key]);
    }
  });
  let strToSign = arr
    .map(key => {
      //return encodeURIComponent(key +"="+ nArgs[key]);
      return encodeURIComponent(key) + '=' + encodeURIComponent(nArgs[key]);
    })
    .join('&');
  strToSign = 'GET&%2F&' + encodeURIComponent(strToSign);

  let signature = crypto
    .createHmac('sha1', AccessKeySecret + '&')
    .update(strToSign)
    .digest()
    .toString('base64'); //base64
  nArgs.Signature = signature;
  arr = Object.keys(nArgs).sort();
  let strQuery = arr
    .map(key => {
      return key + '=' + encodeURIComponent(nArgs[key]);
    })
    .join('&');
  debug(
    'nArgs=',
    nArgs,
    ', query=' + strQuery,
    ', strToSign=',
    strToSign,
    ', AccessKeySecret=',
    AccessKeySecret
  );
  return strQuery;
};

/**
 * 发送短信验证码
 * @param {object} param0
 */
export const SendSms = ({
  AccessKeyId,
  AccessKeySecret,
  PhoneNumbers,
  code,
  OutId
}) => {
  let args = _genCommonArgs({
    Action: 'SendSms',
    Version: '2017-05-25',
    AccessKeyId
  });
  //let {Version,SignatureVersion, SignatureNonce, ...restArgs} = args;
  let strQuery = _sign(
    {
      ...args,
      PhoneNumbers,
      SignName: '帝利文化',
      TemplateCode: 'SMS_76425078',
      TemplateParam: { number: code },
      OutId,
      RegionId: 'cn-hangzhou'
    },
    { AccessKeySecret }
  );
  //this._restUrl = 'http://gw.api.taobao.com/router/rest';
  return _get('http://dysmsapi.aliyuncs.com/?' + strQuery);
};

/**
 * 获取视频信息
 * see also: https://help.aliyun.com/document_detail/56124.html?spm=a2c4g.11186623.6.635.ulIwpp
 * @param {object} param0
 */
export const GetPlayInfo = ({
  AccessKeyId,
  AccessKeySecret,
  VideoId,
  Formats,
  AuthTimeout,
  StreamType,
  Definition
}) => {
  let args = _genCommonArgs({
    Action: 'GetPlayInfo',
    Version: '2017-03-21',
    AccessKeyId
  });
  let strQuery = _sign(
    {
      ...args,
      VideoId,
      Formats,
      AuthTimeout,
      StreamType,
      Definition
    },
    { AccessKeySecret }
  );
  return _get('http://vod.cn-shanghai.aliyuncs.com/?' + strQuery);
};

/**
 * 获取视频播放凭证
 * see also: https://help.aliyun.com/document_detail/52833.html?spm=a2c4g.11186623.6.636.VV9vfY
 * @param {object} param0
 */
export const GetVideoPlayAuth = ({
  AccessKeyId,
  AccessKeySecret,
  VideoId,
  AuthInfoTimeout
}) => {
  let args = _genCommonArgs({
    Action: 'GetVideoPlayAuth',
    Version: '2017-03-21',
    AccessKeyId
  });
  let strQuery = _sign(
    {
      ...args,
      VideoId,
      AuthInfoTimeout
    },
    { AccessKeySecret }
  );
  return _get('http://vod.cn-shanghai.aliyuncs.com/?' + strQuery);
};

/**
 * 获取STS临时凭据
  accessKeyId: 'LTAIgqA3WBiLMu8Q',
  accessKeySecret: 'uHPQpYGXHYcqOCcfsQfVRfoz9mD3jP',
  arn: 'acs:ram::1459759790853733:role/vod-upload'
 * @param {object} param0 
 */
export const AssumeRole = ({
  AccessKeyId,
  AccessKeySecret,
  RoleArn,
  RoleSessionName
}) => {
  let args = _genCommonArgs({
    Action: 'AssumeRole',
    Version: '2015-04-01',
    AccessKeyId
  });
  let strQuery = _sign(
    {
      ...args,
      RoleArn,
      RoleSessionName
    },
    { AccessKeySecret }
  );

  return _get('https://sts.aliyuncs.com/?' + strQuery);
};
