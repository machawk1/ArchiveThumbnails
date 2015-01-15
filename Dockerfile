FROM      ubuntu:latest

RUN       apt-get update
RUN       apt-get install -y git curl nano nodejs npm phantomjs imagemagick
RUN       ln -s /usr/bin/nodejs  /usr/bin/node
RUN       mkdir /apps
ADD       . /apps/nodeapp

WORKDIR   /apps/nodeapp

RUN       npm install

EXPOSE    15421
CMD       ["node", "/apps/nodeapp/AlSummarization.js"]
