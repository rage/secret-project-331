# This dockerfile contains the base dependencies that we need for developing the headless-lms service. We build this manually to in order to effectively cache these build steps.
# You can rebuild this image by running bin/build-dockerfile-development-base in the repo root

FROM rust:bullseye


RUN apt-get update \
  && apt-get install -yy wait-for-it postgresql-client \
    build-essential git clang cmake libstdc++-10-dev libssl-dev libxxhash-dev zlib1g-dev \
  && rm -rf /var/lib/apt/lists/*

# Switch to use the mold linker for better compile times
RUN git clone https://github.com/rui314/mold.git && \
  cd mold && \
  git checkout v1.0.0 && \
  make -j$(nproc) && \
  make install

ENV RUSTFLAGS='-C link-arg=/usr/local/bin/mold'

RUN cargo install sqlx-cli --no-default-features --features postgres && \
  cargo install cargo-watch && \
  cargo install systemfd && \
  rustup component add clippy
WORKDIR /app

RUN useradd -ms /usr/sbin/nologin user
