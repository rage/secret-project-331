# Built from DockerfileBase.dockerfile. The builder target is used in skaffold.production.yml to cache the build
FROM eu.gcr.io/moocfi-public/project-331-headless-lms-dev-base:latest as builder

# create dummy main.rs file so that cargo will download dependencies
# we also are setting the timestamp to a old value because cargo will only
# build new sources if the timestamp older than the previous build.
RUN mkdir src && touch -a -m -t 199901010101.00 src/main.rs && echo "fn main() {}" > src/main.rs && chown -R user /app

USER user
ENV CARGO_HOME=/home/user/.cargo \
  PATH=/home/user/.cargo/bin:$PATH

# Copying only Cargo.toml and Cargo.lock will allow the compilation of dependencies
# to be cached as long as these two files don't change
COPY --chown=user Cargo.toml .
COPY --chown=user Cargo.lock .
COPY --chown=user server/Cargo.toml .
COPY --chown=user models/Cargo.toml .
COPY --chown=user utils/Cargo.toml .

# Compile dependencies
RUN cargo build --release && rm src/main.rs

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
