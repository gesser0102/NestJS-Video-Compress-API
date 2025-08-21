FROM node:18-alpine AS base

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

# Install wget and pnpm
RUN apk add --no-cache wget && npm install -g pnpm

WORKDIR /app

# Copy package.json and pnpm-lock.yaml
COPY package*.json ./

# Install only production dependencies
RUN pnpm install --prod

# Copy built application from base stage
COPY --from=base /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Change ownership of the app directory
RUN chown -R nestjs:nodejs /app
USER nestjs

# Expose port (Cloud Run uses PORT env var)
EXPOSE $PORT

# Health check optimized for Cloud Run
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:$PORT/api/videos || exit 1

# Start the application (Cloud Run manages the port)
CMD ["sh", "-c", "node dist/main"]