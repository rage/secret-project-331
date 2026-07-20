#!/usr/bin/env fish

set -l script_dir (cd (dirname (status --current-filename)); and pwd)
set -l repo_root (realpath "$script_dir/../..")
set -l context "$TILT_KIND_CONTEXT"

if test -z "$context"
    set context kind-kind
end

set -gx NIX_CONFIG "experimental-features = nix-command flakes"
set -gx TILT_DISABLE_ANALYTICS 1

source $script_dir/lib/nix-paths.fish

cd "$repo_root"

if nix develop "$repo_root" --command kubectl --context "$context" cluster-info >/dev/null 2>&1
    echo "Kind cluster context '$context' is reachable."
    exit 0
end

echo "Kind cluster context '$context' is not reachable. Creating it with bin/kubernetes-cluster-create."
nix develop "$repo_root" --command bin/kubernetes-cluster-create
