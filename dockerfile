FROM node:8.11.2
ADD sdist /var/www/sdist
ADD node_modules /var/www/node_modules
EXPOSE 3310
WORKDIR /var/www/
CMD DEBUG="app:*" node sdist