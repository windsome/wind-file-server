FROM node:8.11.2
COPY sdist /var/www/sdist
COPY package.json /var/www/
COPY .babelrc /var/www/
RUN ls -R /var/www
ADD node_modules /var/www/node_modules
EXPOSE 3000
WORKDIR /var/www/
CMD DEBUG="app:*" node sdist
