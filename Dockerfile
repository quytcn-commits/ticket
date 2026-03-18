# ===== Stage 1: Build client =====
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm ci --ignore-scripts
COPY client/ ./
RUN npm run build

# ===== Stage 2: Production server =====
FROM node:20-alpine
WORKDIR /app

# Install only server dependencies
COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy server source
COPY server/src/ ./src/

# Copy built client
COPY --from=client-build /app/client/dist ./client-dist/

# Create data directory for SQLite
RUN mkdir -p /app/data

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app/data
USER appuser

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/checkin.db

EXPOSE 3000

CMD ["node", "src/index.js"]
