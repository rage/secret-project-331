# Built from DockerfileBase.dockerfile
FROM eu.gcr.io/moocfi-public/project-331-headless-lms-dev-base:latest as chef

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
RUN cargo chef cook --recipe-path recipe.json

COPY --chown=user . .
# Compile the program
RUN cargo build

CMD [ "bin/dev" ]
