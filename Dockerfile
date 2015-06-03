FROM      ubuntu:latest

RUN       apt-get update
RUN       apt-get install -y git curl nano nodejs npm phantomjs imagemagick
RUN       ln -s /usr/bin/nodejs  /usr/bin/node
RUN       mkdir /app
ADD       . /app

WORKDIR   /app

RUN       npm install

EXPOSE    15421
EXPOSE    15422
EXPOSE    1338
CMD       ["node", "AlSummarization.js"]
