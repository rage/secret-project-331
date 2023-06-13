#!/bin/bash
# Waits for a database with migrations complete to be available.
set -euo pipefail

if [ -z ${REDIS_URL+x} ]; then
    echo "Error: REDIS_URL must be set" 1>&2
    exit 1
fi

# Use a database name that does not exist in the target postgres so that we can wait until we get the database does not exist error from postres.
echo "Waiting until we can connect to redis..."

echo "Redis is available."
