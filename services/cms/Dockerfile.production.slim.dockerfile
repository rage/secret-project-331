# This image is used in skaffold.production.yaml to create a slim image that is used in production
FROM eu.gcr.io/moocfi-public/project-331-node-cache:latest AS builder

RUN mkdir -p /app/source && chown node /app/source

USER node

WORKDIR /app/source

COPY --chown=node package.json /app/source/
COPY --chown=node pnpm-lock.yaml /app/source/
COPY --chown=node pnpm-workspace.yaml /app/source/
COPY --chown=node scripts /app/source/scripts

RUN pnpm install --frozen-lockfile

COPY --chown=node . /app/source

ENV NEXT_PUBLIC_BASE_PATH="/cms"
ENV NEXT_PUBLIC_SITE_TITLE="MOOC.fi courses"

RUN pnpm run build

FROM eu.gcr.io/moocfi-public/project-331-node-base:latest AS runtime

# Traced from /app (see next.config.js): source/ plus the pnpm/store/ files its symlinks point into
COPY --from=builder /app/source/.next/standalone /app
COPY --from=builder /app/source/.next/static /app/source/.next/static

USER node

WORKDIR /app/source

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server.js"]
