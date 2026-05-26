#!/usr/bin/env fish

set -l script_dir (cd (dirname (status --current-filename)); and pwd)
set -l repo_root (realpath "$script_dir/../..")

set -gx NIX_CONFIG "experimental-features = nix-command flakes"
set -gx NIX_INSTALLER_INIT none

function add_nix_paths
    if test -e /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.fish
        source /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.fish
    end

    if test -d /nix/var/nix/profiles/default/bin
        fish_add_path -m /nix/var/nix/profiles/default/bin
    end

    if test -d "$HOME/.nix-profile/bin"
        fish_add_path -m "$HOME/.nix-profile/bin"
    end
end

add_nix_paths

if not command -q nix
    if test "$PROJECT_331_DEVCONTAINER" != "1"
        echo "Nix is missing, and this shell is not marked as the project devcontainer." >&2
        echo "Refusing to install Nix on the host. Open the devcontainer or run bin/install-nix manually if that is intended." >&2
        exit 1
    end

    if not test -x "$repo_root/bin/install-nix"
        echo "Nix is missing and $repo_root/bin/install-nix is not executable." >&2
        exit 1
    end

    echo "Nix is missing. Installing Nix with the repository installer."
    env NIX_INSTALLER_INIT=none bash "$repo_root/bin/install-nix"
    add_nix_paths
end

if not command -q nix
    echo "Nix installation completed, but nix is still not available in PATH." >&2
    exit 1
end

nix --version

if command -q direnv
    direnv allow "$repo_root"
else
    echo "direnv is not available yet; continuing because nix develop is the source of truth."
end

nix develop "$repo_root" --command true
