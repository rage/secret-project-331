# This image is used in skaffold.production.yml to cache the build
FROM node:16-bullseye-slim as builder

RUN apt-get update \
  && apt-get install -y build-essential vim \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app && chown -R node /app

USER node

WORKDIR /app

COPY --chown=node package.json /app/
COPY --chown=node package-lock.json /app/

RUN npm ci

COPY --chown=node . /app

RUN npm run postinstall

ENV NEXT_PUBLIC_BASE_PATH=""

RUN npm run build
