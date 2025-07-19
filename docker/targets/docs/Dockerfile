# Docs Dockerfile for elizaOS
# Optimized for serving documentation with minimal size

ARG BUN_VERSION=1.2.13

# Build stage - using official bun image
FROM oven/bun:${BUN_VERSION}-alpine AS builder

WORKDIR /build

# Copy package files first for better caching
COPY package.json bun.lock* ./
COPY packages/docs/package.json ./packages/docs/
COPY packages/core/package.json ./packages/core/

# Install dependencies
RUN bun install

# Copy source files
COPY tsconfig.json ./
COPY packages/docs/ ./packages/docs/
COPY packages/core/ ./packages/core/

# Build documentation
WORKDIR /build/packages/docs
RUN bun run build

# Runtime stage - nginx for static serving
FROM nginx:alpine

# Copy built docs from builder
COPY --from=builder /build/packages/docs/build /usr/share/nginx/html

# Configure nginx for single-page app
RUN echo 'server { \
    listen 3000; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 3000

# Run nginx
CMD ["nginx", "-g", "daemon off;"]