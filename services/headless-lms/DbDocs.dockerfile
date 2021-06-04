FROM rust as rust-builder

RUN cargo install sqlx-cli --no-default-features --features postgres

FROM golang:buster

RUN apt-get update \
  && apt-get install -y plantuml \
  && rm -rf /var/lib/apt/lists/*

RUN go get -u github.com/achiku/planter \
  && go get github.com/k1LoW/tbls

COPY --from=rust-builder /usr/local/cargo/bin/sqlx /bin/sqlx
