#!/usr/bin/env fish

set -l script_dir (cd (dirname (status --current-filename)); and pwd)
set -l repo_root (realpath "$script_dir/../..")

set -gx NIX_CONFIG "experimental-features = nix-command flakes"
set -gx NIX_INSTALLER_INIT none

source $script_dir/lib/nix-paths.fish

if not command -q nix
    echo "Nix is missing. It should be installed during devcontainer image build." >&2
    echo "Rebuild the devcontainer image. If this is a host shell, run bin/install-nix manually only if intended." >&2
    exit 1
end

nix --version

if command -q direnv
    direnv allow "$repo_root"
else
    echo "direnv is not available yet; continuing because nix develop is the source of truth."
end
