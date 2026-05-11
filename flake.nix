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
      nixpkgs,
      flake-utils,
      rust-overlay,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [ rust-overlay.overlays.default ];
        };

        lib = pkgs.lib;
        rustToolchain = pkgs.rust-bin.fromRustupToolchainFile ./rust-toolchain.toml;

        opensslPkgConfigPath = lib.makeSearchPath "lib/pkgconfig" [
          pkgs.openssl.dev
          pkgs.zlib.dev
        ];
        fishDevConfig = pkgs.writeText "fish-dev-config.fish" ''
          starship init fish | source
          abbr -a -- c clear
          abbr -a -- gits "git status -sb"
          ${lib.optionalString pkgs.stdenv.isLinux "abbr -a -- open xdg-open"}
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

        # passwd-only getent when /usr/bin/getent is missing (Tilt). Exit 0 only if every key matched.
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

            any_missing=0
            for key in "$@"; do
              found=0
              while IFS=: read -r name pass uid gid gecos home shell; do
                if [ "$name" = "$key" ] || [ "$uid" = "$key" ]; then
                  printf '%s:%s:%s:%s:%s:%s:%s\n' "$name" "$pass" "$uid" "$gid" "$gecos" "$home" "$shell"
                  found=1
                fi
              done < /etc/passwd

              if [ "$found" -eq 0 ]; then
                any_missing=1
              fi
            done

            if [ "$any_missing" -eq 1 ]; then
              exit 2
            fi
            exit 0
          fi

          echo "getent compatibility wrapper only supports passwd without host getent" >&2
          exit 2
        '';

        # Dev-only registries + insecureAcceptAnything policy. Not for prod/CI.
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
        # Podman: temp XDG overlay (host containers/ + store fallbacks) when policy or registries missing; else plain exec.
        podmanWithProjectConfig = pkgs.writeShellScriptBin "podman" ''
          host_xdg_config_home="''${XDG_CONFIG_HOME:-$HOME/.config}"
          host_containers="$host_xdg_config_home/containers"

          host_has_policy=false
          if [ -f "$host_containers/policy.json" ] || [ -f /etc/containers/policy.json ]; then
            host_has_policy=true
          fi

          host_has_registries=false
          if [ -n "''${CONTAINERS_REGISTRIES_CONF:-}" ] \
            || [ -f "$host_containers/registries.conf" ] \
            || [ -f /etc/containers/registries.conf ]; then
            host_has_registries=true
          fi

          if [ "$host_has_policy" = "true" ] && [ "$host_has_registries" = "true" ]; then
            exec ${pkgs.podman}/bin/podman "$@"
          fi

          overlay="$(mktemp -d -t secret-project-331-podman-XXXXXX)"
          trap 'rm -rf "$overlay"' EXIT
          mkdir -p "$overlay/containers"

          if [ -d "$host_containers" ]; then
            find "$host_containers" -mindepth 1 -maxdepth 1 \
              -exec ln -sfn '{}' "$overlay/containers/" \;
          fi

          if [ "$host_has_policy" = "false" ]; then
            ln -sfn "${podmanContainersConfig}/containers/policy.json" \
              "$overlay/containers/policy.json"
          fi

          if [ "$host_has_registries" = "false" ]; then
            ln -sfn "${podmanContainersConfig}/containers/registries.conf" \
              "$overlay/containers/registries.conf"
          fi

          XDG_CONFIG_HOME="$overlay" "${pkgs.podman}/bin/podman" "$@"
        '';
        projectCliPackages = [
          pkgs.actionlint
          pkgs.kubectl
          pkgs.kubectx
          pkgs.kustomize
          pkgs.oxipng
          pkgs.skaffold
          pkgs.sqlx-cli
          pkgs.stern
        ];
        localClusterPackages = [
          pkgs.ctlptl
          pkgs.kind
          pkgs.tilt
        ];
        linuxOnlyPackages = lib.optionals pkgs.stdenv.isLinux [
          pkgs.docker-client
          getentCompat
          pkgs.minikube
          pkgs.mold
          podmanWithProjectConfig
        ];
        pathPriorityPackages = [
          rustToolchain
        ]
        ++ projectCliPackages
        ++ localClusterPackages
        ++ linuxOnlyPackages;
        shellSupportPackages = [
          pkgs.bc
          pkgs.cargo-chef
          pkgs.cargo-watch
          pkgs.cmake
          pkgs.coreutils
          pkgs.curl
          pkgs.file
          pkgs.findutils
          pkgs.fish
          pkgs.gcc
          pkgs.git
          pkgs.gnumake
          pkgs.gnugrep
          pkgs.gnused
          pkgs.gnutar
          pkgs.gzip
          pkgs.jq
          pkgs.libclang
          pkgs.moreutils
          pkgs.openssl
          pkgs.pkg-config
          pkgs.pnpm
          pkgs.postgresql
          pkgs.python3
          pkgs.redis
          pkgs.rsync
          pkgs.starship
          pkgs.systemfd
          pkgs.which
          pkgs.zlib
          pkgs.zstd
        ];

        # Prepended to PATH; must include the podman wrapper before pkgs.podman.
        pathPriorityBinPath = lib.makeBinPath pathPriorityPackages;
      in
      {
        devShells.default = pkgs.mkShell (
          {
            packages = pathPriorityPackages ++ shellSupportPackages;

            OPENSSL_INCLUDE_DIR = "${pkgs.openssl.dev}/include";
            OPENSSL_LIB_DIR = "${pkgs.openssl.out}/lib";
            LIBCLANG_PATH = lib.makeLibraryPath [ pkgs.libclang.lib ];
            STARSHIP_CONFIG = "${starshipConfig}";
            TILT_DISABLE_ANALYTICS = "1";

            shellHook = ''
              export PATH="${pathPriorityBinPath}:$PATH"
              export PKG_CONFIG_PATH="${opensslPkgConfigPath}''${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"

              if [ -z "''${RUSTFLAGS:-}" ] && command -v mold >/dev/null 2>&1; then
                export RUSTFLAGS="-C link-arg=-fuse-ld=mold"
              fi

              # Interactive TTY: exec fish. NO_PROJECT_FISH=1 skips.
              if [ -t 0 ] && [ -t 1 ] && [ -z "''${IN_PROJECT_FISH:-}" ] && [ -z "''${NO_PROJECT_FISH:-}" ]; then
                export IN_PROJECT_FISH=1
                exec ${pkgs.fish}/bin/fish -C 'source ${fishDevConfig}'
              fi
            '';
          }
          // lib.optionalAttrs pkgs.stdenv.isLinux {
            KIND_EXPERIMENTAL_PROVIDER = "podman";
          }
        );
      }
    );
}
