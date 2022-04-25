#!/bin/bash
set -euo pipefail

if [ -z ${DATABASE_URL+x} ]; then
    echo "Error: DATABASE_URL must be set" 1>&2
    exit 1
fi

sqlx database setup
exit $?
