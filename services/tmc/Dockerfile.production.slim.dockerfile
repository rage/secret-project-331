# This image is used in skaffold.production.yaml to create a slim image that is used in production
FROM eu.gcr.io/moocfi-public/project-331-node-cache:latest AS builder

RUN mkdir -p /app/source && chown node /app/source

USER node

WORKDIR /app/source

COPY --chown=node package.json /app/source/
COPY --chown=node pnpm-lock.yaml /app/source/
COPY --chown=node pnpm-workspace.yaml /app/source/
# postinstall runs prepare-pyodide-assets.cjs; copy its inputs before install (full tree COPY is later).
COPY --chown=node scripts/ /app/source/scripts/
COPY --chown=node src/util/pyodide-version.json /app/source/src/util/pyodide-version.json

RUN pnpm install --frozen-lockfile

COPY --chown=node ./bin/tmc-langs-cli-* /tmc/
USER root
RUN rm -f /tmc/*.sha256 && mv /tmc/tmc-langs-cli-* /app/tmc-langs-cli && rmdir /tmc/
USER node

COPY --chown=node . /app/source

ENV PUBLIC_BASE_PATH="/tmc"

RUN pnpm run build

FROM eu.gcr.io/moocfi-public/project-331-node-base:latest AS runtime

WORKDIR /app

# The production server (server.mjs) is dependency-free (only node: builtins + the built output; the
# server routes' dependencies are bundled into dist/server), so no node_modules are copied.
# package.json is needed for its "type": "module" so Node treats the built dist/server/index.js as
# ESM. tmc-langs-cli is spawned by the server routes at /app/tmc-langs-cli.
COPY --from=builder /app/source/dist /app/dist
COPY --from=builder /app/source/server.mjs /app/server.mjs
COPY --from=builder /app/source/iframe-headers.mjs /app/iframe-headers.mjs
COPY --from=builder /app/source/package.json /app/package.json
COPY --from=builder /app/tmc-langs-cli /app/tmc-langs-cli

USER node

EXPOSE 3005

ENV NODE_ENV=production
ENV PORT=3005
ENV PUBLIC_BASE_PATH="/tmc"

CMD ["node", "server.mjs"]
