#!/usr/bin/env fish

set -l script_dir (cd (dirname (status --current-filename)); and pwd)
set -l repo_root (realpath "$script_dir/../..")

set -gx NIX_CONFIG "experimental-features = nix-command flakes"
set -gx TILT_DISABLE_ANALYTICS 1

if test -e /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.fish
    source /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.fish
end
if test -d /nix/var/nix/profiles/default/bin
    fish_add_path -m /nix/var/nix/profiles/default/bin
end
if test -d "$HOME/.nix-profile/bin"
    fish_add_path -m "$HOME/.nix-profile/bin"
end

cd "$repo_root"

"$script_dir/ensure-nix.fish"
"$script_dir/ensure-local-secrets.fish"

if command -q direnv
    direnv allow "$repo_root"
end

nix develop "$repo_root" --command pnpm --version
nix develop "$repo_root" --command rustc --version
nix develop "$repo_root" --command node --version

echo "Post-create setup complete. Run bin/devcontainer-doctor next."
