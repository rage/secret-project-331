FROM eu.gcr.io/moocfi-public/project-331-node-cache:latest

RUN mkdir -p /app/source && chown node /app/source

USER node

WORKDIR /app/source

COPY --chown=node package.json /app/source/
COPY --chown=node pnpm-lock.yaml /app/source/
COPY --chown=node pnpm-workspace.yaml /app/source/

RUN pnpm install --frozen-lockfile

COPY --chown=node . /app/source

RUN pnpm run postinstall

EXPOSE 3000

CMD [ "pnpm", "run", "dev" ]
