#!/bin/bash

set -euo pipefail

usage() {
  echo 1>&2 "Usage: $0 <base_url> <material_dir>"
  echo 1>&2 "Expected env vars in .env: COURSE_ID, UPLOAD_AUTH_COOKIE, TMC_TOKEN"
}

die() {
  echo 1>&2 "Error: $1"
  exit 1
}

if [ $# -ne 2 ]; then
  usage
  exit 2
fi

BASE_URL=${1%/}
MATERIAL_DIR=${2%/}

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

command -v ruby >/dev/null 2>&1 || {
  echo 1>&2 "ruby is required"
  exit 1
}

if [ ! -d "$MATERIAL_DIR" ]; then
  die "Material directory not found: $MATERIAL_DIR"
fi

if [[ "$BASE_URL" != http://* && "$BASE_URL" != https://* ]]; then
  die "base_url must include a scheme, for example https://project-331.local"
fi

if [ -f "$REPO_ROOT/.env" ]; then
  echo "Loading environment from $REPO_ROOT/.env"
  set -a
  . "$REPO_ROOT/.env"
  set +a
fi

: "${UPLOAD_AUTH_COOKIE:?UPLOAD_AUTH_COOKIE must be set in .env}"
: "${TMC_TOKEN:?TMC_TOKEN must be set in .env}"
: "${COURSE_ID:?COURSE_ID must be set in .env}"

echo "Using base_url=$BASE_URL"
echo "Using material_dir=$MATERIAL_DIR"
echo "Using COURSE_ID=$COURSE_ID"

export BASE_URL
export MATERIAL_DIR
export COURSE_ID
export UPLOAD_AUTH_COOKIE

ruby "$SCRIPT_DIR/migrate-material.rb" "$MATERIAL_DIR"

ruby "$SCRIPT_DIR/migrate-material-and-upload.rb"
