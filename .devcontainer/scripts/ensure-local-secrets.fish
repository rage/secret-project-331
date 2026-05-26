#!/usr/bin/env fish

set -l script_dir (cd (dirname (status --current-filename)); and pwd)
set -l repo_root (realpath "$script_dir/../..")

set -l files \
    "$repo_root/kubernetes/dev/headless-lms/env-local-patch.secret.yml" \
    "$repo_root/kubernetes/test/headless-lms/env-local-patch.secret.yml"

set -l missing_before
for file in $files
    if not test -f "$file"
        set -a missing_before "$file"
    end
end

if not bash -lc 'cd "$1" && source bin/.common && make_sure_skaffold_local_env_patch_files_exists' _ "$repo_root"
    echo "Failed to ensure local Kubernetes secret patch files." >&2
    exit 1
end

if test (count $missing_before) -eq 0
    echo "Local Kubernetes secret patch files already exist."
else
    echo "Created missing local Kubernetes secret patch files:"
    for file in $missing_before
        if test -f "$file"
            echo "  $file"
        end
    end
end

