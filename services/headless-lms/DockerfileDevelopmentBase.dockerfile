# This dockerfile contains the base dependencies that we need for developing the headless-lms service. We build this manually to in order to effectively cache these build steps.
# You can rebuild this image by running bin/build-dockerfile-development-base in the repo root
# If you want to deploy the new image, you must push it to the image repository with docker push <image-name>
FROM rust:bullseye as mold-builder

RUN apt-get update \
  && apt-get install -yy build-essential git clang cmake libstdc++-10-dev libssl-dev libxxhash-dev zlib1g-dev sudo \
  && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/rui314/mold.git \
  && cd mold \
  && git checkout v1.0.0 \
  && make -j$(nproc)

FROM rust:bullseye

COPY --from=mold-builder /mold/mold /usr/local/bin/

# Switch to use the mold linker for better compile times
# Using workaround described in https://github.com/rui314/mold#how-to-use
RUN mkdir /mold-ld-workaround \
  && ln -s /usr/local/bin/mold /mold-ld-workaround/ld
ENV RUSTFLAGS='-C link-arg=-B/mold-ld-workaround'

RUN apt-get update \
  && apt-get install -yy wait-for-it postgresql-client \
  && rm -rf /var/lib/apt/lists/*

RUN cargo install sqlx-cli --no-default-features --features postgres,rustls && \
  cargo install cargo-watch && \
  cargo install systemfd && \
  cargo install cargo-chef --locked && \
  rustup component add clippy

WORKDIR /app

RUN useradd -ms /usr/sbin/nologin user
