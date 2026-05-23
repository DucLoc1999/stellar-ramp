#!/bin/sh
set -e

echo "🔧 Starting entrypoint script..."

# Check if required environment variables are set
if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ]; then
    echo "⚠️  Warning: DB_HOST or DB_PORT not set. Skipping database check."
else
    # Wait for database connection
    echo "⏳ Checking database connection at $DB_HOST:$DB_PORT..."
    timeout=60
    counter=0
    
    while ! nc -z $DB_HOST $DB_PORT; do
        counter=$((counter + 1))
        if [ $counter -ge $timeout ]; then
            echo "❌ Database connection timeout after ${timeout}s"
            exit 1
        fi
        echo "   Waiting for database... (${counter}s)"
        sleep 1
    done
    echo "✅ Database connected!"
fi

# Ensure logs directory exists with correct permissions
if [ -d "/app/logs" ]; then
    echo "📝 Setting up logs directory..."
    chown -R node:node /app/logs
    chmod -R 755 /app/logs
else
    echo "⚠️  Logs directory not found, creating..."
    mkdir -p /app/logs
    chown -R node:node /app/logs
    chmod -R 755 /app/logs
fi

# Switch to non-root user and execute the command
echo "👤 Switching to 'node' user..."
echo "🚀 Starting application: $@"
exec su-exec node "$@"
