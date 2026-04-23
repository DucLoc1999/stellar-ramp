#!/bin/sh
set -e
# check db connection
echo "Checking database connection..."
while ! nc -z $DB_HOST $DB_PORT; do
    sleep 1
done
echo "Database connected!"

if [ -d "/app/logs" ]; then
    echo "1"
    chown -R node:node /app/logs
    chmod -R 755 /app/logs
fi
echo "2"
exec su-exec node "$@"
echo "Server started!"