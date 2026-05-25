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

        mkPackageManagerStub =
          name: hint:
          pkgs.writeShellScriptBin name ''
            echo "error: ${name} is not used in this project." >&2
            echo "Use pnpm instead. ${hint}" >&2
            exit 1
          '';

        packageManagerStubs = [
          (mkPackageManagerStub "npm" "Example: pnpm install, pnpm run <script>.")
          (mkPackageManagerStub "npx" "Example: pnpm exec <pkg>, or pnpm dlx <pkg>.")
          (mkPackageManagerStub "yarn" "Example: pnpm install, pnpm run <script>.")
          (mkPackageManagerStub "yarnpkg" "Example: pnpm install, pnpm run <script>.")
        ];

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
              printed_uids=""
              while IFS=: read -r name pass uid gid gecos home shell; do
                if [ "$name" = "$key" ] || [ "$uid" = "$key" ]; then
                  case " $printed_uids " in
                    *" $uid "*) ;;
                    *)
                      printf '%s:%s:%s:%s:%s:%s:%s\n' "$name" "$pass" "$uid" "$gid" "$gecos" "$home" "$shell"
                      printed_uids="$printed_uids $uid"
                      ;;
                  esac
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
          getentCompat
          pkgs.minikube
          pkgs.mold
        ];
        pathPriorityPackages = packageManagerStubs ++ [
          pkgs.nodejs_24
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
          pkgs.systemfd
          pkgs.which
          pkgs.zlib
          pkgs.zstd
        ];

        pathPriorityBinPath = lib.makeBinPath pathPriorityPackages;
      in
      {
        devShells.default = pkgs.mkShell (
          {
            packages = pathPriorityPackages ++ shellSupportPackages;

            OPENSSL_INCLUDE_DIR = "${pkgs.openssl.dev}/include";
            OPENSSL_LIB_DIR = "${pkgs.openssl.out}/lib";
            LIBCLANG_PATH = lib.makeLibraryPath [ pkgs.libclang.lib ];
            TILT_DISABLE_ANALYTICS = "1";

            shellHook = ''
              export PATH="${pathPriorityBinPath}:$PATH"
              export PKG_CONFIG_PATH="${opensslPkgConfigPath}''${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"

              if [ -z "''${RUSTFLAGS:-}" ] && command -v mold >/dev/null 2>&1; then
                export RUSTFLAGS="-C link-arg=-fuse-ld=mold"
              fi
            '';
          }
        );
      }
    );
}
