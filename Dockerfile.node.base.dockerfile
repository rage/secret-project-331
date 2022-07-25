FROM node:16-bullseye-slim

RUN npm install -g npm@8.3.1 && \
  # Please read these two docs for the following options before changing them -- they work a bit differently than you'd expect:
  # https://docs.npmjs.com/cli/v8/using-npm/config
  # https://github.com/tim-kos/node-retry#retrytimeoutsoptions
  npm config set --location=global fetch-retry-maxtimeout=900000 && \
  npm config set --location=global fetch-retry-mintimeout=10000 && \
  npm config set --location=global fetch-timeout=1200000 && \
  npm config set --location=global fetch-retries=15 && \
  npm config set --location=global fetch-retry-factor=2

RUN apt-get update \
  && apt-get upgrade -yy \
  && rm -rf /var/lib/apt/lists/*
