#!/bin/bash
# Waits for a database with migrations complete to be available.
set -euo pipefail

if [ -z ${DATABASE_URL+x} ]; then
    echo "Error: DATABASE_URL must be set" 1>&2
    exit 1
fi

echo "Waiting until I psql can connect to the database..."
until test "$(psql "echo \"$DATABASE_URL\" | sed 's/headless_lms_/database_that_should_not_exist_/'" -c 'SELECT 83256;' --csv | grep -c 'database_that_should_not_exist_')" -eq 1 2> /dev/null; do
  echo -n "."
  sleep 1
done

# Clear line because echo -n above wont print line breaks
echo ""

echo "Database is available: psql was able to connect."
