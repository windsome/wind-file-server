import _debug from 'debug';
const debug = _debug('app:upload:aliyun');
import ALY from 'aliyun-sdk';
import config from '../cfg';

let cfgAliyunVod = config.aliyunVod;
let sts = new ALY.STS({
  accessKeyId: cfgAliyunVod.accessKeyId,
  secretAccessKey: cfgAliyunVod.accessKeySecret,
  endpoint: 'https://sts.aliyuncs.com',
  apiVersion: '2015-04-01'
});

export const assumeRole = () => {
  debug(
    'sts:',
    {
      accessKeyId: cfgAliyunVod.accessKeyId,
      secretAccessKey: cfgAliyunVod.accessKeySecret,
      endpoint: 'https://sts.aliyuncs.com',
      apiVersion: '2015-04-01'
    },
    'assumeRole:',
    {
      Action: 'AssumeRole',
      RoleArn: cfgAliyunVod.arn,
      RoleSessionName: 'windsome1'
    }
  );
  return new Promise((resolve, reject) => {
    // 构造AssumeRole请求
    sts.assumeRole(
      {
        Action: 'AssumeRole',
        // 指定角色Arn
        RoleArn: cfgAliyunVod.arn,
        // Policy: JSON.stringify({
        //   Statement: [
        //     {
        //       Action: 'sts:AssumeRole',
        //       Effect: 'Allow',
        //       Principal: {
        //         RAM: ['acs:ram::1459759790853733:root']
        //       }
        //     }
        //   ],
        //   Version: '1'
        // }),
        //设置Token的附加Policy，可以在获取Token时，通过额外设置一个Policy进一步减小Token的权限；
        //Policy: '{"Version":"1","Statement":[{"Effect":"Allow", "Action":"*", "Resource":"*"}]}',
        //设置Token有效期，可选参数，默认3600秒；
        //DurationSeconds: 3600,
        RoleSessionName: 'windsome1'
      },
      function(err, res) {
        debug('assumeRole result:', err, res);
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      }
    );
  });
};

export const getCallerIdentity = () => {
  return new Promise((resolve, reject) => {
    //构造GetCallerIdentity请求
    sts.getCallerIdentity(
      {
        Action: 'GetCallerIdentity'
      },
      function(err, res) {
        debug('getCallerIdentity result:', err, res);
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      }
    );
  });
};
