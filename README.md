## 项目简介
这是上传服务器,包含本地文件服务器,阿里云,腾讯云等的上传。

## 文档
[api接口](./doc/apis.md)
[在线api文档](https://windsome.github.io/wind-file-server/index.html)

## 打包发布流程
1. 编译及打包发布
```
npm install
npm run build
npm run tar
```

## 用node直接运行
```
npm install
npm run build
node sdist
```

## docker打包及运行
1. 打包
docker build . -t windsome/uploader:1.0.3
docker push windsome/uploader:1.0.3
2. 运行
docker run -p 11717:11717 windsome/uploader:1.0.3
3. 映射卷到docker内部.
docker run -p 11717:11717 -v /home/data/uploads:/home/data/uploads windsome/uploader:1.0.3

## 用k8s运行
kubectl apply -f https://raw.githubusercontent.com/windsome/wind-file-server/master/uploader.svc.deploy.yaml

## 用apidoc生成接口文档
```
npm run apidoc
```
### 基本描述
一般情况下服务器端生成的文件名格式为:<32位hash值>.<文件size>.<原始文件名末尾11个字符><扩展名>
如: CED0577F526E84D2CC31901EA6708789.212145.wx_fmt=jpeg //这里没有扩展名
如: 620A26F524F83D2D2AFDE12F1E47EBDC.683972.44的屏幕截图.png
### 接口描述-proxy
`GET /apis/v1/upload/proxy/:url`用来跨域访问图片资源等,注意url需要用base64编码.
```
let thumb_url='http://mmbiz.qpic.cn/mmbiz_jpg/B5gjzuAr3uqCTCrMXVeEd5C14ge8AzGtxTGloZfIf14TCz29KtcPrQdl6jicdJIavbg2atShePV6ibRnlqySlrHQ/0?wx_fmt=jpeg';
let src = '/apis/v1/upload/proxy/'+btoa(thumb_url);
<img src={src} /> //此img即可正常显示图片.
```
### 接口描述-url
`POST|GET /apis/v1/upload/url`用来下载某个url的资源到服务器上.
```
参数: {url[,filename]}
返回: {
  errcode: 0,
  message: 'ok',
  url: '/uploads/620A26F524F83D2D2AFDE12F1E47EBDC.683972.44的屏幕截图.png'
}
例子:
let thumb_url='http://mmbiz.qpic.cn/mmbiz_jpg/B5gjzuAr3uqCTCrMXVeEd5C14ge8AzGtxTGloZfIf14TCz29KtcPrQdl6jicdJIavbg2atShePV6ibRnlqySlrHQ/0?wx_fmt=jpeg';
fetch('/apis/v1/upload/url?url='+thumb_url); // GET方式
fetch('/apis/v1/upload/url', {method:'POST', body:{url:thumb_url}}); // POST方式
```
### 接口描述-form
`POST /apis/v1/upload/form`传统表单中file-input上传模式.`Content-Type="multipart/form-data"`
```
参数: files fileinput的文件列表
返回: {
  errcode: 0, 
  files: {
    <原始文件名1>:<服务器端文件名1>
    <原始文件名2>:<服务器端文件名2>
  }
}
例子:无
```
### 接口描述-chunked分块上传大文件
+ `POST /apis/v1/upload/chunked/start`初始化参数开始上传`Content-Type="multipart/*"`,
```
请求参数:
{
    name:"test.jpg" // 文件名称.
    size:12352  // 文件大小.
    hash:"xxxxxxx" // 文件hash值.如果不填则不检查文件hash是否存在.
}
已上传过的文件,直接返回url,无需触发后续传输
{
    errcode: 0,
    message: 'ok',
    status:'finish', // 状态. finish表示已经上传过,ready表示等待上传.
    url: '/uploads/' + destname // 上传后文件链接地址
}
未上传过,已准备好接收数据开始上传:
{
    errcode: 0,
    message: 'ok',
    status:'ready', // 状态. finish表示已经上传过,ready表示等待上传.
    destname, // 上传时的中间文件名称,会放在/uploads/tmp目录,上传完成后在文件名中添加hash并动到/uploads目录.
}
错误结果:
{
    errcode: !=0, //ERR_NOT_MULTPART
    message: '错误消息'
}
```
+ `POST /apis/v1/upload/chunked/upload`分块上传`Content-Type="multipart/*"`,
```
请求参数:
{
 destname:"xxxxxxtest.jpg" // 必须,服务器端中间文件名称,由start命令返回.在/uploads/tmp/下
 start:0 // 当前块在文件中的开始位置.
}
成功响应:
{
 errcode: 0,
 message: 'ok',
 destname, // 中间文件名称,不是最终的文件.
}
错误例子:
{
 errcode: !=0, //ERR_NOT_MULTPART
 message: '错误消息'
}
```
+ `POST /apis/v1/upload/chunked/end`完成上传`Content-Type="multipart/*"`,
```
请求参数:
{
 name:"test.jpg" // 文件名称.
 size:1235234534  // 文件大小.
 hash:"xxxxxxx" // 可选,文件hash值,用来校验.无此参数将不校验.
 destname:"xxxxxxtest.jpg" // 服务器端中间文件名称,由start命令返回.在/uploads/tmp下
}
成功响应:
{
 errcode: 0,
 message: 'ok',
 url: '/uploads/' + destname // 上传后文件最终链接地址,注意,不是中间文件名称.
}
错误例子:
{
 errcode: !=0, //ERR_NOT_MULTPART
 message: '错误消息'
}
```

## 注意事项
1. 安装apidoc
默认apidoc在处理json的POST、PUT时有问题，是按formdata传的。需要使用插件`npm install --save-dev https://github.com/koko-ng/apidoc-contentType-plugin`，之后在`package.json`中增加一条命令`"apidoc": "apidoc -i src/ -o doc/apis/ -t node_modules/apidoc-contenttype-plugin/template/ --parse-parsers apicontenttype=node_modules/apidoc-contenttype-plugin/api_content_type.js"`，以后可以运行`npm run apidoc`生成文档