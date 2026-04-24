#!/bin/sh
set -e

# Fix permissions for the logs directory
# This is necessary because when the volume is mounted from the host,
# it may have different ownership/permissions than what's set in the Dockerfile
if [ -d "/app/logs" ]; then
  echo "Fixing permissions for /app/logs directory..."
  chown -R node:node /app/logs
  chmod -R 755 /app/logs
fi

if [ -d "/app/data" ]; then
  echo "Fixing permissions for /app/data directory..."
  chown -R node:node /app/data
  chmod -R 755 /app/data
fi

# Switch to node user and execute the main command
echo "Starting application as node user..."
exec su-exec node "$@"

