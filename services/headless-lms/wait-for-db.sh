#!/bin/bash
# Waits for a database with migrations complete to be available.
set -euo pipefail

if [ -z ${DATABASE_URL+x} ]; then
    echo "Error: DATABASE_URL must be set" 1>&2
    exit 1
fi

# Use a database name that does not exist in the target postgres so that we can wait until we get the database does not exist error from postres.
NON_EXISTING_DB_URL="${DATABASE_URL//headless_lms_/database_that_should_not_exist_}"
echo "Waiting until psql can connect to the database..."
# Succeeeds when we get `psql: error: FATAL:  database "database_that_should_not_exist_dev" does not exist`
until test "$( (timeout 5 psql "$NON_EXISTING_DB_URL" -c 'SELECT 83256;' --csv 2>&1 || true) | grep -c 'database_that_should_not_exist_')" -eq 1 2> /dev/null; do
  echo -n "."
  sleep 1
done

# Clear line because echo -n above wont print line breaks
echo ""

echo "Database is available: psql was able to connect."
