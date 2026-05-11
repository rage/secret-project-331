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
        linuxOnlyPackages = lib.optionals pkgs.stdenv.isLinux [
          pkgs.docker-client
          pkgs.minikube
          pkgs.mold
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
        downloadApplicationsBinPath = lib.makeBinPath downloadApplicationsPackages;
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
            export PATH="${downloadApplicationsBinPath}:$PATH"
            export PKG_CONFIG_PATH="${opensslPkgConfigPath}''${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"

            if [ -z "''${RUSTFLAGS:-}" ] && command -v mold >/dev/null 2>&1; then
              export RUSTFLAGS="-C link-arg=-fuse-ld=mold"
            fi

            if [ -t 0 ]; then
              exec fish -C 'set -gx PATH (string split : "${downloadApplicationsBinPath}") $PATH; source ${fishDevConfig}'
            fi
          '';
        };
      }
    );
}
