# This dockerfile contains the base dependencies that we need for developing the headless-lms service. We build this manually to in order to effectively cache these build steps.
# You can rebuild this image by running bin/build-dockerfile-development-base in the repo root
# If you want to deploy the new image, you must push it to the image repository with docker push <image-name>
FROM rust:bookworm AS dep-builder

RUN apt-get update \
  && apt-get install -yy build-essential git clang libssl-dev zlib1g-dev gcc g++ file sudo \
  && rm -rf /var/lib/apt/lists/*

# RUSTUP_TOOLCHAIN overrides mold's rust-toolchain.toml, which would download a second toolchain
RUN git clone --depth 1 --branch v3.0.0 https://github.com/rui314/mold.git \
  && cd mold \
  && RUSTUP_TOOLCHAIN="$(rustup show active-toolchain | cut -d' ' -f1)" cargo build --release --locked

# Provides a mapping from ip to country
RUN mkdir -p /etc/apt/keyrings \
  && curl -fsSL -o /etc/apt/keyrings/ipfire-libloc.asc https://packages.ipfire.org/debian/libloc/E4D20FA6FAA108D54ABDFC6541836ADF9D5E2AD9.asc \
  && echo "deb [signed-by=/etc/apt/keyrings/ipfire-libloc.asc] https://packages.ipfire.org/debian/libloc bookworm main" > /etc/apt/sources.list.d/location.list \
  && apt-get update \
  && apt-get install -yy location \
  && rm -rf /var/lib/apt/lists/*

RUN location update \
  && mkdir -p /ips-to-country \
  && location export --directory /ips-to-country \
  && gzip /ips-to-country/*

FROM rust:bookworm AS icu4x-builder

# Keep in sync with the icu version in certificates/Cargo.toml: the generated blob only
# contains the data markers datagen knows about, and a newer icu loads markers that an
# older datagen never emitted.
RUN cargo install icu4x-datagen --version 2.3.0 --locked

RUN icu4x-datagen \
  --markers all \
  --locales full \
  --format blob \
  --out /icu4x.postcard \
  --overwrite

FROM rust:bookworm AS rust-base

COPY --from=dep-builder /mold/target/release/mold /usr/local/bin/
RUN ln -s mold /usr/local/bin/ld.mold

# Links about twice as fast as rustc's default rust-lld
ENV RUSTFLAGS='-C link-arg=-fuse-ld=mold'

RUN apt-get update \
  && apt-get install -yy wait-for-it postgresql-client redis-tools \
  && rm -rf /var/lib/apt/lists/*

RUN cargo install sqlx-cli --no-default-features --features postgres,rustls && \
  cargo install cargo-watch && \
  cargo install systemfd && \
  cargo install cargo-chef --locked && \
  rustup component add clippy

COPY --from=icu4x-builder /icu4x.postcard /icu4x.postcard
COPY --from=icu4x-builder /icu4x.postcard /icu4x.postcard.2

COPY --from=dep-builder /ips-to-country /ips-to-country

WORKDIR /app

RUN useradd -ms /usr/sbin/nologin user

ENV CARGO_HOME=/home/user/.cargo \
  PATH=/home/user/.cargo/bin:$PATH

# Downloads only: prebuilt dependencies go stale with the next Cargo.lock change, and service builds cook anyway
FROM rust-base AS dependency-fetcher

COPY --chown=user:user . /app/

USER user

RUN cargo fetch --locked

FROM rust-base

COPY --from=dependency-fetcher --chown=user:user /home/user/.cargo /home/user/.cargo

USER root
