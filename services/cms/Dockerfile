FROM eu.gcr.io/moocfi-public/project-331-node-base:latest

RUN mkdir -p /app && chown -R node /app

USER node

WORKDIR /app

COPY --chown=node package.json /app/
COPY --chown=node package-lock.json /app/
COPY --chown=node scripts /app/scripts

RUN npm ci

COPY --chown=node . /app

EXPOSE 3021

CMD [ "npm", "run", "dev" ]
