FROM eu.gcr.io/moocfi-public/project-331-node-base:latest

RUN apt-get update \
  && apt-get install -y build-essential \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app && chown -R node /app

USER node

WORKDIR /app

COPY --chown=node package.json /app/
COPY --chown=node package-lock.json /app/

RUN npm ci

COPY --chown=node . /app

EXPOSE 3002

CMD [ "npm", "run", "dev" ]
