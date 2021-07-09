# Built from DockerfileBase.dockerfile
FROM eu.gcr.io/moocfi-public/project-331-headless-lms-dev-base:latest

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

# Compile dependencies
RUN cargo build --release && rm src/main.rs

COPY --chown=user . .
# Compile the program
RUN cargo build --release

CMD [ "cargo", "run", "--release" ]
