FROM node:16-bullseye-slim

ENV NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=300000 NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=100000

RUN apt-get update \
  && apt-get upgrade -yy \
  && rm -rf /var/lib/apt/lists/*
