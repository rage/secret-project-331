FROM node:14

RUN apt-get update \
  && apt-get install -y build-essential vim \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app && chown -R node /app

USER node

WORKDIR /app

COPY --chown=node package.json /app/
COPY --chown=node package-lock.json /app/

RUN npm ci

COPY --chown=node . /app

ENV BASE_PATH="/playground"
RUN npm run build

EXPOSE 3005

CMD [ "npm", "run", "start" ]
