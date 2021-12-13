# The builder target is used skaffold.production.yml to cache the build
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

ENV NEXT_PUBLIC_BASE_PATH=""

RUN npm run build

# The runtime target is used skaffold.production.yml to create a slim image that is used in production
FROM node:16-bullseye-slim as runtime

COPY --from=builder /app/.next/standalone /app
COPY --from=builder /app/.next/static /app/.next/static

USER node

WORKDIR /app

EXPOSE 3000

CMD [ "npm", "run", "start" ]
