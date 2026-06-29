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

        # The `playwright-cli` command from the @playwright/cli npm package
        # (https://playwright.dev/agent-cli/introduction). Not the @playwright/test runner
        # used by system-tests, and not in nixpkgs, so we assemble it from its three npm
        # tarballs and drive it with the nixpkgs Chromium baked into the wrapper, avoiding
        # any browser download. Bump all three hashes together when raising the version.
        playwrightCliVersion = "0.1.14";
        playwrightAlpha = "1.61.0-alpha-1781023400000";
        playwrightCli = pkgs.stdenvNoCC.mkDerivation {
          pname = "playwright-cli";
          version = playwrightCliVersion;
          dontUnpack = true;

          nativeBuildInputs = [ pkgs.makeWrapper ];

          srcCli = pkgs.fetchurl {
            url = "https://registry.npmjs.org/@playwright/cli/-/cli-${playwrightCliVersion}.tgz";
            hash = "sha512-DoKzrzEN/ivdxFy61Kbqzsz/U4+6F6Nk1Psu9hSYYYriqhzifW57VuNciuXjFS5Xuyhb8aXcy5hCgbDdqr3EIg==";
          };
          srcPlaywright = pkgs.fetchurl {
            url = "https://registry.npmjs.org/playwright/-/playwright-${playwrightAlpha}.tgz";
            hash = "sha512-8TRUG3IvwaAhuVm6k3C5vB7CwC5Fxq76DCCxOgPr6r1dpTedDwxlmdOBUkSZ0zxfxP14jcuPxi86/Trq4eA03w==";
          };
          srcPlaywrightCore = pkgs.fetchurl {
            url = "https://registry.npmjs.org/playwright-core/-/playwright-core-${playwrightAlpha}.tgz";
            hash = "sha512-UdtUd9qnCO0zvb8p3OvOZpelY6mA40mTb3NmWGuMtrD+hqqWuorWCPlSGwj7jw/LEB9AxvYLHTL1CJi2flvksg==";
          };

          installPhase = ''
            runHook preInstall

            modules="$out/lib/node_modules"
            mkdir -p "$modules/@playwright/cli" "$modules/playwright" "$modules/playwright-core"
            tar -xzf "$srcCli"           --strip-components=1 -C "$modules/@playwright/cli"
            tar -xzf "$srcPlaywright"    --strip-components=1 -C "$modules/playwright"
            tar -xzf "$srcPlaywrightCore" --strip-components=1 -C "$modules/playwright-core"

            makeWrapper ${pkgs.nodejs_24}/bin/node "$out/bin/playwright-cli" \
              --add-flags "$modules/@playwright/cli/playwright-cli.js" \
              --set-default PLAYWRIGHT_MCP_EXECUTABLE_PATH ${pkgs.chromium}/bin/chromium

            runHook postInstall
          '';

          meta = {
            description = "Playwright CLI (@playwright/cli) for coding agents, driving the nixpkgs Chromium";
            mainProgram = "playwright-cli";
            platforms = pkgs.lib.platforms.linux;
          };
        };

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
          playwrightCli
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
          pkgs.git-lfs
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
            # tikv-jemalloc-sys configure uses -O0 -Werror; glibc fortify warns
            # without optimization, so disable only fortify/fortify3 from Nix defaults.
            hardeningDisable = [
              "fortify"
              "fortify3"
            ];

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
