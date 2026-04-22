#!/bin/sh
set -e

# Run database migrations
echo "Running database migrations..."
DB_HOST="$DB_HOST" \
DB_PORT="$DB_PORT" \
DB_USER="$DB_USER" \
DB_PASSWORD="$DB_PASSWORD" \
DB_NAME="$DB_NAME" \
DB_SCHEMA="$DB_SCHEMA" \
npm run migrate

# Fix permissions for the logs directory
if [ -d "/app/logs" ]; then
    echo "Fixing permissions for /app/logs directory..."
    chown -R node:node /app/logs
    chmod -R 755 /app/logs
fi

# Switch to node user and execute the main command
echo "Starting application as node user..."
exec su-exec node "$@"