FROM rust as rust-builder

RUN cargo install sqlx-cli --no-default-features --features rustls,postgres

FROM golang:buster as go-builder

RUN go install github.com/achiku/planter@latest \
  && go install github.com/k1LoW/tbls@latest

FROM debian:buster-slim

RUN apt-get update \
  && apt-get install -y plantuml postgresql-client pandoc git coreutils sed \
  && rm -rf /var/lib/apt/lists/*

COPY --from=rust-builder /usr/local/cargo/bin/sqlx /bin/sqlx
COPY --from=go-builder /go/bin/planter /bin/planter
COPY --from=go-builder /go/bin/tbls /bin/tbls
