#!/bin/bash
# Waits for a database with migrations complete to be available.
set -euo pipefail

if [ -z ${DATABASE_URL+x} ]; then
    echo "Error: DATABASE_URL must be set" 1>&2
    exit 1
fi

echo "Waiting until I find the courses table in postgres..."
until test "$(psql "$DATABASE_URL" -c '\d' --csv | grep -c ',courses,table,')" -eq 1 2> /dev/null; do
  echo -n "."
  sleep 1
done

# Clear line because echo -n above wont print line breaks
echo ""

echo "Database is available: courses table found."

# The script can also wait for additional tables by passing them as arguments
for table in "$@"; do
  echo "Waiting until I find the $table table in postgres..."
  until test "$(psql "$DATABASE_URL" -c '\d' --csv | grep -c ",$table,table,")" -eq 1 2> /dev/null; do
    echo -n "."
    sleep 1
  done
  # Clear line because echo -n above wont print line breaks
  echo ""
  echo "Database is available: $table table found."
done
