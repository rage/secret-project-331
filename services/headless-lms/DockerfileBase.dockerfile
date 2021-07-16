FROM rust

RUN apt-get update \
  && apt-get install -yy wait-for-it postgresql-client \
  && rm -rf /var/lib/apt/lists/*

RUN cargo install sqlx-cli --no-default-features --features postgres && \
  cargo install cargo-watch && \
  cargo install systemfd && \
  rustup component add clippy
WORKDIR /app

RUN useradd -ms /usr/sbin/nologin user
