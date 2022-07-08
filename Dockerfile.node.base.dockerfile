FROM node:16-bullseye-slim

RUN npm install -g npm@8.3.1 && \
  npm config set --location=global fetch-retry-maxtimeout=900000 && \
  npm config set --location=global fetch-retry-mintimeout=300000 && \
  npm config set --location=global fetch-timeout=1200000 && \
  npm config set --location=global fetch-retries=4 && \
  npm config set --location=global fetch-retry-factor=10

RUN apt-get update \
  && apt-get upgrade -yy \
  && rm -rf /var/lib/apt/lists/*
