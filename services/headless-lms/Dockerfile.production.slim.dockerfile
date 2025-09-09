# This image is used in skaffold.production.yaml to create a slim image that is used in production
FROM eu.gcr.io/moocfi-public/project-331-headless-lms-dev-base:latest as chef
RUN chown -R user /app
USER user
WORKDIR /app

FROM chef AS planner

COPY --chown=user . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef as builder

USER user

ENV CARGO_HOME=/home/user/.cargo \
  PATH=/home/user/.cargo/bin:$PATH

# compile dependencies
COPY --chown=user --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

COPY --chown=user . .
# Compile the program
RUN cargo build --release

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
COPY --from=builder /app/bin/run /app/bin/run

# Used in the test mode
RUN mkdir uploads && chown -R user uploads

# Mappings from ips to coutry
COPY --from=builder /ips-to-country /ips-to-country

# ICU4X data provider blob
COPY --from=builder /icu4x.postcard /icu4x.postcard
# TODO: Remove this in the next release, this is a temporary file for compatibility
COPY --from=builder /icu4x.postcard.2 /icu4x.postcard.2

USER user

CMD [ "bin/run", "start-server" ]
