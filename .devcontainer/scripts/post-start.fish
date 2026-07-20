#!/usr/bin/env fish

set -l script_dir (cd (dirname (status --current-filename)); and pwd)
set -l repo_root (realpath "$script_dir/../..")

cd "$repo_root"

echo "Devcontainer started."
echo "Run bin/devcontainer-doctor to check readiness."
echo "Run bin/devcontainer-up to create the Kind cluster and start Tilt."

if not test -S /var/run/docker.sock
    echo "Warning: /var/run/docker.sock is missing. Docker-outside-of-Docker is required for the Kind/Tilt workflow."
end

