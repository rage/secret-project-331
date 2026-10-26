# This image is used in skaffold.production.yaml to create a slim image that is used in production
FROM eu.gcr.io/moocfi-public/project-331-node-cache:latest AS builder

RUN mkdir -p /app/source && chown node /app/source

USER node

WORKDIR /app/source

COPY --chown=node package.json /app/source/
COPY --chown=node pnpm-lock.yaml /app/source/
COPY --chown=node pnpm-workspace.yaml /app/source/

RUN pnpm install --frozen-lockfile

COPY --chown=node . /app/source

ENV PUBLIC_BASE_PATH="/example-exercise"

RUN pnpm run build

FROM eu.gcr.io/moocfi-public/project-331-node-base:latest AS runtime

WORKDIR /app

# The production server (server.mjs) is dependency-free (only node: builtins + the built output),
# so no node_modules are copied. package.json is needed for its "type": "module" so Node treats the
# built dist/server/index.js as ESM.
COPY --from=builder /app/source/dist /app/dist
COPY --from=builder /app/source/server.mjs /app/server.mjs
COPY --from=builder /app/source/iframe-headers.mjs /app/iframe-headers.mjs
COPY --from=builder /app/source/package.json /app/package.json

USER node

EXPOSE 3002

ENV NODE_ENV=production
ENV PORT=3002
ENV PUBLIC_BASE_PATH="/example-exercise"

CMD ["node", "server.mjs"]
