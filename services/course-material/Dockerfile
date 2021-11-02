FROM node:16

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

EXPOSE 3003

CMD [ "npm", "run", "dev" ]
