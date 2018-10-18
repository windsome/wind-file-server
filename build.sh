# bash
set -e
export VERSION=1.0.4
npm run build
docker build . -t windsome/uploader:$VERSION
docker tag windsome/uploader:$VERSION windsome/uploader:latest
docker push windsome/uploader:$VERSION
docker push windsome/uploader:latest
