#!/bin/bash

set -euo pipefail

usage() {
  echo 1>&2 "Usage: $0 <base_url> <material_dir> [migrate-material.rb options]"
  echo 1>&2 "Expected env vars (from the environment or .env): COURSE_ID, UPLOAD_AUTH_COOKIE, TMC_TOKEN"
  echo 1>&2 "MIGRATION_RESUME=1 continues an interrupted import into the same course"
  echo 1>&2 "Options: bundle exec ruby misc/material-migration/migrate-material.rb --help"
}

die() {
  echo 1>&2 "Error: $1"
  exit 1
}

if [ $# -lt 2 ]; then
  usage
  exit 2
fi

BASE_URL=${1%/}
MATERIAL_DIR=${2%/}
shift 2

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

MIGRATION_DIR="$REPO_ROOT/misc/material-migration"
export BUNDLE_GEMFILE="$MIGRATION_DIR/Gemfile"

command -v ruby >/dev/null 2>&1 || {
  echo 1>&2 "ruby is required"
  exit 1
}

command -v bundle >/dev/null 2>&1 || {
  echo 1>&2 "bundler is required (ships with Ruby); run 'gem install bundler' if missing"
  exit 1
}

if ! bundle check >/dev/null; then
  echo "Installing migration dependencies (bundle install)"
  bundle install
fi

if [ ! -d "$MATERIAL_DIR" ]; then
  die "Material directory not found: $MATERIAL_DIR"
fi

if [[ "$BASE_URL" != http://* && "$BASE_URL" != https://* ]]; then
  die "base_url must include a scheme, for example https://project-331.local"
fi

if [ -f "$REPO_ROOT/.env" ]; then
  echo "Loading environment from $REPO_ROOT/.env (variables already set take precedence)"
  # A COURSE_ID given on the command line must win, or a run can upload into the wrong course.
  preset_environment=$(export -p)
  set -a
  . "$REPO_ROOT/.env"
  set +a
  eval "$preset_environment"
fi

: "${UPLOAD_AUTH_COOKIE:?UPLOAD_AUTH_COOKIE must be set in .env}"
: "${TMC_TOKEN:?TMC_TOKEN must be set in .env}"
: "${COURSE_ID:?COURSE_ID must be set in .env}"

echo "Using base_url=$BASE_URL"
echo "Using material_dir=$MATERIAL_DIR"
echo "Using COURSE_ID=$COURSE_ID"

MIGRATION_OUTPUT_DIR=$(mktemp -d "${TMPDIR:-/tmp}/material-migration.XXXXXX")
echo "Writing converted pages to $MIGRATION_OUTPUT_DIR"

export BASE_URL
export COURSE_ID
export UPLOAD_AUTH_COOKIE
export MIGRATION_OUTPUT_DIR

bundle exec ruby "$MIGRATION_DIR/migrate-material.rb" --output-dir "$MIGRATION_OUTPUT_DIR" "$@" "$MATERIAL_DIR"

bundle exec ruby "$MIGRATION_DIR/migrate-material-and-upload.rb"
