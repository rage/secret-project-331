# This dockerfile contains the base dependencies that we need for developing the headless-lms service. We build this manually to in order to effectively cache these build steps.
# You can rebuild this image by running bin/build-dockerfile-development-base in the repo root
# If you want to deploy the new image, you must push it to the image repository with docker push <image-name>
FROM rust:bookworm as dep-builder

RUN apt-get update \
  && apt-get install -yy build-essential git clang cmake libssl-dev zlib1g-dev gcc g++ file sudo \
  && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/rui314/mold.git \
  && mkdir mold/build \
  && cd mold/build \
  && git checkout v2.2.0 \
  && cmake -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_COMPILER=c++ .. \
  && cmake --build . -j $(nproc)

# Provides a mapping from ip to country
RUN curl https://packages.ipfire.org/79842AA7CDBA7AE3-pub.asc | apt-key add - \
  && echo "deb     https://packages.ipfire.org/location bookworm/" > /etc/apt/sources.list.d/location.list \
  && apt-get update \
  && apt-get install -yy location \
  && rm -rf /var/lib/apt/lists/*

RUN location update \
  && mkdir -p /ips-to-country \
  && location export --directory /ips-to-country \
  && gzip /ips-to-country/*

FROM rust:bookworm

COPY --from=dep-builder /mold/build /usr/local/bin/

# Switch to use the mold linker for better compile times
# Using workaround described in https://github.com/rui314/mold#how-to-use
RUN mkdir /mold-ld-workaround \
  && ln -s /usr/local/bin/mold /mold-ld-workaround/ld
ENV RUSTFLAGS='-C link-arg=-B/mold-ld-workaround'

RUN apt-get update \
  && apt-get install -yy wait-for-it postgresql-client redis-tools \
  && rm -rf /var/lib/apt/lists/*

RUN cargo install sqlx-cli --no-default-features --features postgres,rustls && \
  cargo install cargo-watch && \
  cargo install systemfd && \
  cargo install cargo-chef --locked && \
  cargo install icu_datagen && \
  rustup component add clippy

RUN icu4x-datagen \
  --keys all \
  --locales fi \
  --locales en \
  --format blob \
  --out /icu4x.postcard

COPY --from=dep-builder /ips-to-country /ips-to-country

WORKDIR /app

RUN useradd -ms /usr/sbin/nologin user

ENV CARGO_HOME=/home/user/.cargo \
  PATH=/home/user/.cargo/bin:$PATH
