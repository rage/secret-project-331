# This image is used in skaffold.production.yml to create a slim image that is used in production
ARG BUILD_CACHE

FROM $BUILD_CACHE as builder

# Middle stage where we can remove unnecessary files
FROM eu.gcr.io/moocfi-public/project-331-headless-lms-production-base:latest as cleanup

WORKDIR /app

COPY --from=builder /app/target/release /app/full-build
RUN mkdir bins && find ./full-build -maxdepth 1 -executable -type f -exec cp "{}" ./bins \;

# The runtime target is used in skaffold.production.yml to create a slim image that is used in production
FROM eu.gcr.io/moocfi-public/project-331-headless-lms-production-base:latest as runtime

WORKDIR /app

COPY --from=cleanup /app/bins /app
COPY --from=builder /app/migrations /app/migrations
COPY --from=builder /app/wait-for-db.sh /app/
COPY --from=builder /app/wait-for-db-migrations.sh /app/

# Used in the test mode
RUN mkdir uploads && chown -R user uploads

USER user

CMD [ "./headless-lms-actix" ]
