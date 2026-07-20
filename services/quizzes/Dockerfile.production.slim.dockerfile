# This image is used in skaffold.production.yaml to create a slim image that is used in production
FROM eu.gcr.io/moocfi-public/project-331-node-cache:latest AS builder

RUN mkdir -p /app && chown -R node /app

USER node

WORKDIR /app

COPY --chown=node package.json /app/
COPY --chown=node pnpm-lock.yaml /app/
COPY --chown=node pnpm-workspace.yaml /app/

RUN pnpm install --frozen-lockfile

COPY --chown=node . /app

ENV PUBLIC_BASE_PATH="/quizzes"

RUN pnpm run build

FROM eu.gcr.io/moocfi-public/project-331-node-base:latest AS runtime

WORKDIR /app

# The production server (server.mjs) is dependency-free (only node: builtins + the built output),
# so no node_modules are copied. package.json is needed for its "type": "module" so Node treats the
# built dist/server/index.js as ESM.
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/server.mjs /app/server.mjs
COPY --from=builder /app/iframe-headers.mjs /app/iframe-headers.mjs
COPY --from=builder /app/package.json /app/package.json

USER node

EXPOSE 3004

ENV NODE_ENV=production
ENV PORT=3004
ENV PUBLIC_BASE_PATH="/quizzes"

CMD ["node", "server.mjs"]
