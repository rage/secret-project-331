# This image is used in skaffold.production.yaml to cache the build
FROM eu.gcr.io/moocfi-public/project-331-node-base:latest as builder

RUN mkdir -p /app && chown -R node /app

USER node

WORKDIR /app

COPY --chown=node package.json /app/
COPY --chown=node package-lock.json /app/

RUN npm ci

COPY --chown=node . /app

ENV NEXT_PUBLIC_BASE_PATH="/quizzes"

RUN npm run build
