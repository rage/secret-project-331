{
  description = "Development shell for Secret Project 331";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";

    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      rust-overlay,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [ rust-overlay.overlays.default ];
        };

        lib = pkgs.lib;
        rustToolchainConfig = builtins.fromTOML (builtins.readFile ./rust-toolchain.toml);
        rustChannel = rustToolchainConfig.toolchain.channel;
        rustVersion =
          if builtins.match "^[0-9]+\\.[0-9]+$" rustChannel != null then
            "${rustChannel}.0"
          else
            rustChannel;
        rustToolchain = pkgs.rust-bin.stable.${rustVersion}.default.override {
          extensions = [
            "clippy"
            "rust-analyzer"
            "rust-src"
            "rustfmt"
          ];
        };

        opensslPkgConfigPath = lib.makeSearchPath "lib/pkgconfig" [
          pkgs.openssl.dev
          pkgs.zlib.dev
        ];
        fishDevConfig = pkgs.writeText "fish-dev-config.fish" ''
          starship init fish | source
          abbr -a -- c clear
          abbr -a -- gits "git status -sb"
          ${lib.optionalString pkgs.stdenv.isLinux ''abbr -a -- open xdg-open''}
        '';
        starshipConfig = pkgs.writeText "starship.toml" ''
          add_newline = false
          format = "$directory[ \\$ ](dimmed white)$git_branch$git_status[ \\$ ](dimmed white)$character"

          [directory]
          truncation_length = 3
          truncation_symbol = "../"

          [git_branch]
          symbol = ""
          format = "[$branch]($style)"

          [git_status]
          format = "([$all_status$ahead_behind]($style))"

          [character]
          success_symbol = "[\\$](bold green)"
          error_symbol = "[\\$](bold red)"
        '';
        getentCompat = pkgs.writeShellScriptBin "getent" ''
          if [ -x /usr/bin/getent ]; then
            exec /usr/bin/getent "$@"
          fi

          if [ "''${1:-}" = "passwd" ]; then
            shift

            if [ "$#" -eq 0 ]; then
              cat /etc/passwd
              exit 0
            fi

            status=2
            for key in "$@"; do
              found=0
              while IFS=: read -r name pass uid gid gecos home shell; do
                if [ "$name" = "$key" ] || [ "$uid" = "$key" ]; then
                  printf '%s:%s:%s:%s:%s:%s:%s\n' "$name" "$pass" "$uid" "$gid" "$gecos" "$home" "$shell"
                  found=1
                  status=0
                fi
              done < /etc/passwd

              if [ "$found" -eq 0 ]; then
                status=2
              fi
            done

            exit "$status"
          fi

          echo "getent compatibility wrapper only supports passwd without host getent" >&2
          exit 2
        '';
        podmanContainersConfig = pkgs.runCommand "podman-containers-config" { } ''
          mkdir -p "$out/containers"

          cat > "$out/containers/registries.conf" <<'EOF'
          unqualified-search-registries = ["docker.io"]
          EOF

          cat > "$out/containers/policy.json" <<'EOF'
          {
            "default": [
              {
                "type": "insecureAcceptAnything"
              }
            ]
          }
          EOF
        '';
        podmanWithProjectConfig = pkgs.writeShellScriptBin "podman" ''
          host_containers_config_dir="$HOME/.config/containers"

          if [ -z "''${CONTAINERS_REGISTRIES_CONF:-}" ] \
            && [ ! -f "$host_containers_config_dir/registries.conf" ] \
            && [ ! -f /etc/containers/registries.conf ]; then
            mkdir -p "$host_containers_config_dir"
            install -m 0644 "${podmanContainersConfig}/containers/registries.conf" "$host_containers_config_dir/registries.conf"
          fi

          if [ ! -f "$host_containers_config_dir/policy.json" ] \
            && [ ! -f /etc/containers/policy.json ]; then
            mkdir -p "$host_containers_config_dir"
            install -m 0644 "${podmanContainersConfig}/containers/policy.json" "$host_containers_config_dir/policy.json"
          fi

          exec ${pkgs.podman}/bin/podman "$@"
        '';
        linuxOnlyPackages = lib.optionals pkgs.stdenv.isLinux [
          pkgs.docker-client
          getentCompat
          pkgs.minikube
          pkgs.mold
          podmanWithProjectConfig
        ];
        localClusterPackages = [
          pkgs.ctlptl
          pkgs.kind
          pkgs.tilt
        ];
        downloadApplicationsPackages =
          [
            rustToolchain
            pkgs.actionlint
            pkgs.kubectl
            pkgs.kubectx
            pkgs.kustomize
            pkgs.oxipng
            pkgs.skaffold
            pkgs.sqlx-cli
            pkgs.stern
          ]
          ++ lib.optionals pkgs.stdenv.isLinux [
            pkgs.minikube
          ];
        priorityBinPath = lib.makeBinPath (downloadApplicationsPackages ++ localClusterPackages ++ linuxOnlyPackages);
      in
      {
        devShells.default = pkgs.mkShell {
          packages =
            [
              rustToolchain
              pkgs.actionlint
              pkgs.bc
              pkgs.cargo-chef
              pkgs.cargo-watch
              pkgs.cmake
              pkgs.coreutils
              pkgs.curl
              pkgs.ctlptl
              pkgs.file
              pkgs.findutils
              pkgs.gcc
              pkgs.git
              pkgs.gnumake
              pkgs.gnugrep
              pkgs.gnused
              pkgs.gnutar
              pkgs.gzip
              pkgs.jq
              pkgs.kind
              pkgs.kubectl
              pkgs.kubectx
              pkgs.kustomize
              pkgs.libclang
              pkgs.moreutils
              pkgs.openssl
              pkgs.oxipng
              pkgs.pkg-config
              pkgs.pnpm
              pkgs.postgresql
              pkgs.python3
              pkgs.redis
              pkgs.rsync
              pkgs.skaffold
              pkgs.sqlx-cli
              pkgs.stern
              pkgs.systemfd
              pkgs.tilt
              pkgs.which
              pkgs.zlib
              pkgs.zstd
              pkgs.fish
              pkgs.starship
            ]
            ++ linuxOnlyPackages;

          OPENSSL_DIR = "${pkgs.openssl.dev}";
          LIBCLANG_PATH = lib.makeLibraryPath [ pkgs.libclang.lib ];
          STARSHIP_CONFIG = "${starshipConfig}";

          shellHook = ''
            export PATH="${priorityBinPath}:$PATH"
            ${lib.optionalString pkgs.stdenv.isLinux ''export KIND_EXPERIMENTAL_PROVIDER=podman''}
            export TILT_DISABLE_ANALYTICS=1
            export PKG_CONFIG_PATH="${opensslPkgConfigPath}''${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"

            if [ -z "''${RUSTFLAGS:-}" ] && command -v mold >/dev/null 2>&1; then
              export RUSTFLAGS="-C link-arg=-fuse-ld=mold"
            fi

            if [ -t 0 ]; then
              exec fish -C 'set -gx PATH (string split : "${priorityBinPath}") $PATH; ${lib.optionalString pkgs.stdenv.isLinux "set -gx KIND_EXPERIMENTAL_PROVIDER podman; "}set -gx TILT_DISABLE_ANALYTICS 1; source ${fishDevConfig}'
            fi
          '';
        };
      }
    );
}
