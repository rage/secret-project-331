FROM eu.gcr.io/moocfi-public/project-331-node-cache:latest

RUN mkdir -p /app/source && chown node /app/source

USER node

WORKDIR /app/source

COPY --chown=node package.json /app/source/
COPY --chown=node pnpm-lock.yaml /app/source/
COPY --chown=node pnpm-workspace.yaml /app/source/
# postinstall runs scripts/prepare-pyodide-assets.cjs, so copy scripts/ before install.
COPY --chown=node scripts/ /app/source/scripts/

RUN pnpm install --frozen-lockfile

COPY --chown=node ./bin/tmc-langs-cli-* /tmc/
USER root
RUN rm -f /tmc/*.sha256 && mv /tmc/tmc-langs-cli-* /app/tmc-langs-cli && rmdir /tmc/
USER node

COPY --chown=node . /app/source

EXPOSE 3005

CMD [ "pnpm", "run", "dev" ]
