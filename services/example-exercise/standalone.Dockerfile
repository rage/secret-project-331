# syntax=docker/dockerfile:1
# The scaffolder ships this as a generated project's Dockerfile; the monorepo builds with
# Dockerfile.production.slim.dockerfile instead.

# Node 24 and the pnpm major of package.json's packageManager: another major can resolve a
# different tree from the same lockfile.
FROM node:24-slim AS build
WORKDIR /app

RUN npm install --global pnpm@11

# Dependencies before sources, so editing a component does not reinstall them.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Inlined into both bundles at build time; there is no runtime override, so browser-side
# configuration is a build arg too. PUBLIC_BASE_PATH must equal the runtime value below; empty is
# correct where the service owns its whole hostname, as on Cloud Run.
ARG PUBLIC_BASE_PATH=""
ARG NEXT_PUBLIC_SERVICE_SLUG=""
ENV PUBLIC_BASE_PATH=${PUBLIC_BASE_PATH}
ENV NEXT_PUBLIC_SERVICE_SLUG=${NEXT_PUBLIC_SERVICE_SLUG}
RUN pnpm run build

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# No node_modules: the server bundle inlines its dependencies. package.json stays for
# "type": "module", without which dist/server/index.js loads as CommonJS. --chown because COPY
# keeps the build stage's modes, which a umask 077 checkout makes unreadable to the node user.
# Every module server.mjs imports must be listed here (src/lib/dockerfiles.test.ts checks).
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/server.mjs /app/iframe-headers.mjs /app/graceful-shutdown.mjs ./
COPY --from=build --chown=node:node /app/dist ./dist

ARG PUBLIC_BASE_PATH=""
ENV PUBLIC_BASE_PATH=${PUBLIC_BASE_PATH}

# Cloud Run injects PORT and ignores EXPOSE; this default is for running the image directly.
ENV PORT=8080
EXPOSE 8080

USER node

CMD ["node", "server.mjs"]
