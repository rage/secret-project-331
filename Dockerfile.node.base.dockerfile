FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get upgrade -yy \
  && apt-get install -yy build-essential \
  && rm -rf /var/lib/apt/lists/*

# Please read these two docs for the following options before changing them -- they work a bit differently than you'd expect:
# https://docs.npmjs.com/cli/v8/using-npm/config
# https://github.com/tim-kos/node-retry#retrytimeoutsoptions
RUN npm config set --location=global fetch-retry-maxtimeout=900000 && \
  npm config set --location=global fetch-retry-mintimeout=10000 && \
  npm config set --location=global fetch-timeout=1200000 && \
  npm config set --location=global fetch-retries=15 && \
  npm config set --location=global fetch-retry-factor=2 && \
  # https://github.com/npm/cli/issues/4652
  npm config set --location=global maxsockets=1 && \
  npm config set --location=global noproxy=registry.npmjs.org

# Configure pnpm using the root .npmrc
COPY .npmrc /root/.npmrc

# Install pnpm and the node version specified in .npmrc
RUN mkdir -p /tmp/test-project && \
  cd /tmp/test-project && \
  cp /root/.npmrc . && \
  echo '{"name": "temp", "version": "1.0.0", "packageManager": "pnpm@10.17.1"}' > package.json && \
  npm install -g --no-update-notifier corepack@latest && \
  corepack install && \
  corepack enable pnpm && \
  echo "pnpm version $(pnpm --version)" && \
  pnpm install --ignore-scripts && \
  rm -rf /tmp/test-project
