#!/usr/bin/env fish

set -l script_dir (cd (dirname (status --current-filename)); and pwd)
set -l repo_root (realpath "$script_dir/../..")

set -gx NIX_CONFIG "experimental-features = nix-command flakes"
set -gx TILT_DISABLE_ANALYTICS 1

cd "$repo_root"

"$script_dir/ensure-nix.fish"
"$script_dir/ensure-local-secrets.fish"

nix develop "$repo_root" --command pnpm --version
nix develop "$repo_root" --command rustc --version
nix develop "$repo_root" --command node --version

echo "Post-create setup complete. Run bin/devcontainer-doctor next."
