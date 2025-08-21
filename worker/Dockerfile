FROM node:18-alpine AS base

# Install ffmpeg and other dependencies
RUN apk add --no-cache ffmpeg

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package.json and pnpm-lock.yaml
COPY package*.json ./

# Install dependencies
RUN pnpm install

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Production stage
FROM node:18-alpine AS production

# Install ffmpeg and other dependencies
RUN apk add --no-cache ffmpeg curl

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package.json and pnpm-lock.yaml
COPY package*.json ./

# Install only production dependencies
RUN pnpm install --prod

# Copy built application from base stage
COPY --from=base /app/dist ./dist

# Create directories for temporary files
RUN mkdir -p /app/temp

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S worker -u 1001

# Change ownership of the app directory
RUN chown -R worker:nodejs /app
USER worker

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Expose port for Cloud Run health checks (worker doesn't serve HTTP but Cloud Run expects it)
EXPOSE 8080

# Start the application
CMD ["node", "dist/index.js"]