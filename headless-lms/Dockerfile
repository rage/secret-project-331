# Built from DockerfileBase.dockerfile
FROM eu.gcr.io/moocfi-public/project-331-headless-lms-dev-base:latest

# create dummy main.rs file so that cargo will download dependencies
# we also are setting the timestamp to a old value because cargo will only
# build new sources if the timestamp older than the previous build.
RUN mkdir src && touch -a -m -t 199901010101.00 src/lib.rs
# Copying only Cargo.toml and Cargo.lock will allow the compilation of dependencies
# to be cached as long as these two files don't change
COPY Cargo.toml .
COPY Cargo.lock .

# Compile dependencies
RUN cargo build && rm src/lib.rs

COPY . .
# Compile the program
RUN cargo build

CMD [ "bin/dev" ]
