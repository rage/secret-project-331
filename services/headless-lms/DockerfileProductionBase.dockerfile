# In this dockerfile, we build a production base image that is intended to be much smaller than the development base image. This is done to ensure we can get the production images running without requiring multi-gigabyte image downloads.
# You can rebuild this image by running bin/build-dockerfile-production-base in the repo root

# We use the development image as a source
FROM eu.gcr.io/moocfi-public/project-331-headless-lms-dev-base:latest as source

FROM debian:bullseye-slim

RUN useradd -ms /usr/sbin/nologin user

RUN apt-get update \
  && apt-get install -yy wait-for-it postgresql-client \
  && rm -rf /var/lib/apt/lists/*

COPY --from=source /usr/local/cargo/bin/sqlx /usr/local/bin/sqlx
