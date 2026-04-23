# --- STAGE 1: BUILD ---
FROM node:24-alpine AS builder
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY . .  
RUN npm install
RUN npm run build

# --- STAGE 2: PRODUCTION ---
FROM node:24-alpine AS production
RUN apk update
RUN apk add --no-cache su-exec
# RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/package-lock.json ./

RUN npm ci --omit=dev

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /app/logs && \
    chown -R node:node /app/logs && \
    chmod -R 755 /app/logs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

CMD ["echo", "Server not started"]
CMD ["node", "dist/server.js"]
