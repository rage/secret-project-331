# This image is used in skaffold.production.yaml to create a slim image that is used in production
FROM eu.gcr.io/moocfi-public/project-331-node-cache:latest as builder

RUN mkdir -p /app && chown -R node /app

USER node

WORKDIR /app

COPY --chown=node package.json /app/
COPY --chown=node pnpm-lock.yaml /app/
COPY --chown=node pnpm-workspace.yaml /app/

RUN pnpm install --frozen-lockfile

COPY --chown=node . /app

RUN pnpm run postinstall

ENV NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_SITE_TITLE="MOOC.fi courses"

RUN pnpm run build

FROM eu.gcr.io/moocfi-public/project-331-node-base:latest as runtime

COPY --from=builder /app/.next/standalone /app
COPY --from=builder /app/.next/static /app/.next/static
COPY --from=builder /app/public /app/public

USER node

WORKDIR /app

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server.js"]
