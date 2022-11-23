# This image is used in skaffold.production.yaml to cache the build
FROM eu.gcr.io/moocfi-public/project-331-node-base:latest as builder

RUN mkdir -p /app && chown -R node /app

USER node

WORKDIR /app

COPY --chown=node package.json /app/
COPY --chown=node package-lock.json /app/

RUN npm ci

COPY --chown=node . /app

RUN npm run postinstall

ENV NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_SITE_TITLE="MOOC.fi courses"

RUN npm run build
