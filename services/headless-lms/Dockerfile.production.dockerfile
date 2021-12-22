# Built from DockerfileBase.dockerfile. The builder target is used in skaffold.production.yml to cache the build
FROM eu.gcr.io/moocfi-public/project-331-headless-lms-dev-base:latest as chef
RUN cargo install cargo-chef --locked

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM planner as builder

RUN chown -R user /app
USER user
ENV CARGO_HOME=/home/user/.cargo \
  PATH=/home/user/.cargo/bin:$PATH

# compile dependencies
COPY --chown=user --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

COPY --chown=user . .
# Compile the program
RUN cargo build --release

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
