# This image is used in skaffold.production.yaml to create a slim image that is used in production
ARG BUILD_CACHE

FROM $BUILD_CACHE as builder

USER root
# Middle step so we can only copy the required binaries and not copy other large compilation artifacts
RUN mkdir /bins && find /app/target/release -maxdepth 1 -executable -type f -not -name "*.so" -exec cp "{}" /bins \;

# The runtime target is used in skaffold.production.yaml to create a slim image that is used in production
FROM eu.gcr.io/moocfi-public/project-331-headless-lms-production-base:latest as runtime

WORKDIR /app

COPY --from=builder /bins /app
COPY --from=builder /app/migrations /app/migrations
COPY --from=builder /app/wait-for-db.sh /app/
COPY --from=builder /app/wait-for-db-migrations.sh /app/

# Used in the test mode
RUN mkdir uploads && chown -R user uploads

# Mappings from ips to coutry
COPY --from=builder /ips-to-country /ips-to-country

USER user

CMD [ "./headless-lms-server" ]
