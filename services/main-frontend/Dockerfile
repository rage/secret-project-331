FROM eu.gcr.io/moocfi-public/project-331-node-base:latest

RUN mkdir -p /app && chown -R node /app

USER node

WORKDIR /app

COPY --chown=node package.json /app/
COPY --chown=node package-lock.json /app/

RUN npm ci

COPY --chown=node . /app

RUN npm run postinstall

ENV NEXT_PUBLIC_PUBLIC_ADDRESS="http://project-331.local"

EXPOSE 3000

CMD [ "npm", "run", "dev" ]
