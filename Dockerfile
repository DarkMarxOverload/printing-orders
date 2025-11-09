FROM node:18-alpine

WORKDIR /usr/src/app

# install dependencies
COPY package.json package-lock.json* ./
RUN npm install --production && npm cache clean --force

# copy app
COPY . ./

EXPOSE 3000
CMD [ "node", "server.js" ]
