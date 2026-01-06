#!/bin/sh
set -e

echo "Running database migrations..."
node dist/db/migrate.js

echo "Starting Discord League Bot..."
exec node dist/index.js
