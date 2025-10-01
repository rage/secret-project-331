# Create a dummy project for installing the right pnpm and node versions
FROM node:22-bookworm-slim AS dummy-project-builder

RUN mkdir -p /tmp/dummy-project
WORKDIR /tmp/dummy-project
COPY pnpm-workspace.yaml /tmp/dummy-project/pnpm-workspace.yaml
COPY package.json /tmp/dummy-project/real-package.json
RUN PNPM_VERSION=$(grep -o '"packageManager": "pnpm@[^"]*"' real-package.json | sed 's/.*pnpm@\([^"]*\).*/\1/') && \
  echo "{\"name\": \"temp\", \"version\": \"1.0.0\", \"packageManager\": \"pnpm@$PNPM_VERSION\"}" > package.json

FROM node:22-bookworm-slim AS node-base

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

# Copy dummy project
COPY --from=dummy-project-builder /tmp/dummy-project /tmp/dummy-project

# Install pnpm and the node version specified in the dummy project
RUN mkdir -p /tmp/dummy-project && \
  cd /tmp/dummy-project && \
  npm install -g --no-update-notifier corepack@latest && \
  chown -R node:node /tmp/dummy-project && \
  # Setup corepack as the node user so that the build process can find it later on.
  su node -c "corepack install && \
  corepack enable pnpm && \
  echo 'pnpm version $(pnpm --version)' && \
  pnpm install --ignore-scripts" && \
  rm -rf /tmp/dummy-project

# Cache pnpm store in a consistent location
ENV PNPM_HOME="/pnpm"
RUN mkdir -p $PNPM_HOME && chown -R node:node $PNPM_HOME

# Cache all dependendencies in the project to the pnpm store
FROM node-base AS cache-dependencies

COPY . /tmp/cache-build/
RUN chown -R node:node /tmp/cache-build

USER node

RUN cd /tmp/cache-build && pnpm fetch \
  && cd /tmp/cache-build/services/cms && pnpm fetch \
  && cd /tmp/cache-build/services/course-material && pnpm fetch \
  && cd /tmp/cache-build/services/example-exercise && pnpm fetch \
  && cd /tmp/cache-build/services/main-frontend && pnpm fetch \
  && cd /tmp/cache-build/services/quizzes && pnpm fetch \
  && cd /tmp/cache-build/services/tmc && pnpm fetch

# Create final stage with cached dependencies
FROM node-base

# Copy the cached dependencies
COPY --from=cache-dependencies --chown=node:node $PNPM_HOME $PNPM_HOME

USER root
