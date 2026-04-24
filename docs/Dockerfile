# Multi-stage build for production optimization

# Stage 1: Build stage
# Using Node 22 LTS as fallback if Node 24 has connectivity issues
# Change back to node:24-alpine once Docker Hub connection is stable
FROM node:24-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for building)
RUN npm ci

# Copy source code and configuration files
COPY . .

# Build TypeScript code
RUN npm run build

# Stage 2: Production stage
FROM node:24-alpine AS production

# Install su-exec for secure user switching
RUN apk add --no-cache su-exec

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy knexfile for migrations
COPY --from=builder /app/knexfile.ts ./knexfile.ts

# Copy database migrations and seeds
COPY --from=builder /app/database ./database

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create logs directory with proper ownership
# Note: When volume is mounted, entrypoint script will fix permissions at runtime
RUN mkdir -p /app/logs && \
    chown -R node:node /app/logs && \
    chmod -R 755 /app/logs

# Expose application port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use entrypoint script to fix permissions and switch to node user
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Start the application
CMD ["node", "dist/src/server.js"]

