FROM eu.gcr.io/moocfi-public/project-331-node-base:latest

RUN mkdir -p /app && chown -R node /app

USER node

WORKDIR /app

COPY --chown=node package.json /app/
COPY --chown=node pnpm-lock.yaml /app/
COPY --chown=node pnpm-workspace.yaml /app/

RUN pnpm install --frozen-lockfile

COPY --chown=node . /app

EXPOSE 3004

CMD [ "pnpm", "run", "dev" ]
