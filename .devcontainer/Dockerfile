FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ENV DEBIAN_FRONTEND=noninteractive
ENV NIX_CONFIG="experimental-features = nix-command flakes"
ENV NIX_INSTALLER_INIT=none
ENV PROJECT_331_DEVCONTAINER=1
ENV PATH="/home/vscode/.nix-profile/bin:/nix/var/nix/profiles/default/bin:${PATH}"

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash-completion \
    ca-certificates \
    curl \
    direnv \
    fish \
    git \
    gnupg \
    iproute2 \
    jq \
    lsb-release \
    netcat-openbsd \
    openssh-client \
    patch \
    procps \
    sudo \
    xz-utils \
  && rm -rf /var/lib/apt/lists/*

COPY --chown=vscode:vscode bin/install-nix bin/.common /tmp/bin/

USER vscode
RUN chmod +x /tmp/bin/install-nix \
  && env NIX_INSTALLER_INIT=none PROJECT_331_DEVCONTAINER=1 bash /tmp/bin/install-nix \
  && rm -rf /tmp/bin \
  && nix --version
