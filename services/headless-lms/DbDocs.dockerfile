FROM rust as rust-builder

RUN cargo install sqlx-cli --no-default-features --features rustls,postgres


FROM golang:buster

RUN apt-get update \
  && apt-get install -y plantuml postgresql-client pandoc \
  && rm -rf /var/lib/apt/lists/*

RUN go install github.com/achiku/planter@latest \
  && go install github.com/k1LoW/tbls@latest

COPY --from=rust-builder /usr/local/cargo/bin/sqlx /bin/sqlx
