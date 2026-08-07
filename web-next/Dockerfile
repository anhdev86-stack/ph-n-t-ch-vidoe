# Build stage
FROM node:22-alpine AS builder

# Install libc6-compat for Alpine
RUN apk add --no-cache libc6-compat

# Set working directory
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build-time arguments
# Chỉ NEXT_PUBLIC_* cần ở build (Next inline vào bundle). NEXTAUTH_URL để build cho tiện.
# NEXTAUTH_SECRET là secret RUNTIME — KHÔNG nhận ở build để tránh lọt vào layer/history.
ARG NEXT_PUBLIC_API_URL
ARG NEXTAUTH_URL

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}

# Build the application
RUN npm run build

# Production stage - using standalone output
FROM node:22-alpine AS runner

WORKDIR /app

# Runtime env (NEXTAUTH_URL/NEXTAUTH_SECRET được cấp qua docker-compose lúc chạy)
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Add non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output and required files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Set user
USER nextjs

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"] 