FROM eu.gcr.io/moocfi-public/project-331-node-cache:latest

RUN mkdir -p /app && chown -R node /app

USER node

WORKDIR /app

COPY --chown=node package.json /app/
COPY --chown=node pnpm-lock.yaml /app/
COPY --chown=node pnpm-workspace.yaml /app/
# postinstall runs prepare-pyodide-assets.cjs; copy its inputs before install (full tree COPY is later).
COPY --chown=node scripts/ /app/scripts/
COPY --chown=node src/util/pyodide-version.json /app/src/util/pyodide-version.json

RUN pnpm install --frozen-lockfile

COPY --chown=node ./bin/tmc-langs-cli-* /tmc/
USER root
RUN rm -f /tmc/*.sha256 && mv /tmc/tmc-langs-cli-* /app/tmc-langs-cli && rmdir /tmc/
USER node

COPY --chown=node . /app

EXPOSE 3005

CMD [ "pnpm", "run", "dev" ]
