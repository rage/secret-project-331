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
  && make -j$(nproc) \
  && sudo make install

FROM rust:bullseye

# Switch to use the mold linker for better compile times
ENV RUSTFLAGS='-C link-arg=/usr/local/bin/mold'

COPY --from=mold-builder /usr/local/bin/mold /usr/local/bin/

RUN apt-get update \
  && apt-get install -yy wait-for-it postgresql-client \
  && rm -rf /var/lib/apt/lists/*

RUN cargo install sqlx-cli --no-default-features --features postgres && \
  cargo install cargo-watch && \
  cargo install systemfd && \
  rustup component add clippy

WORKDIR /app

RUN useradd -ms /usr/sbin/nologin user
