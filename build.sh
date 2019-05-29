# bash
set -e
VERSION=`awk -F"\"" '/version/{print $4}' package.json`
echo '开始编译及打包:'$VERSION

# export VERSION=1.0.5
npm run build
docker build . -t windsome/uploader:$VERSION
docker tag windsome/uploader:$VERSION windsome/uploader:latest
docker login --username=86643838@163.com --password=a12345678 registry.cn-shanghai.aliyuncs.com
docker push windsome/uploader:$VERSION
docker push windsome/uploader:latest
