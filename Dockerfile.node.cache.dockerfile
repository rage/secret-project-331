FROM eu.gcr.io/moocfi-public/project-331-node-base:latest as base

# Cache all dependendencies in the project to the pnpm store
FROM base AS cache-dependencies

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
FROM base

# Copy the cached dependencies
COPY --from=cache-dependencies --chown=node:node $PNPM_HOME $PNPM_HOME

USER root
