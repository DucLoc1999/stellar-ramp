#!/bin/sh
set -e

if [ -d "/app/logs" ]; then
    chown -R node:node /app/logs
    chmod -R 755 /app/logs
fi

exec su-exec node "$@"
