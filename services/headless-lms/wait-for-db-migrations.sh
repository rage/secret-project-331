#!/bin/bash
# Waits for a database with migrations complete to be available.
set -euo pipefail

echo "Waiting until I find the courses table in postgres..."
until test "$(psql "$DATABASE_URL" -c '\d' --csv | grep -c ',courses,table,')" -eq 1 2> /dev/null; do
  echo -n "."
  sleep 1
done

echo "Database is available: courses table found."
