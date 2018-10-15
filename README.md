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

## 注意事项
1. 安装apidoc
默认apidoc在处理json的POST、PUT时有问题，是按formdata传的。需要使用插件`npm install --save-dev https://github.com/koko-ng/apidoc-contentType-plugin`，之后在`package.json`中增加一条命令`"apidoc": "apidoc -i src/ -o doc/apis/ -t node_modules/apidoc-contenttype-plugin/template/ --parse-parsers apicontenttype=node_modules/apidoc-contenttype-plugin/api_content_type.js"`，以后可以运行`npm run apidoc`生成文档