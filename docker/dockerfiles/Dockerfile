# Multi-stage Dockerfile for elizaOS with multiple targets
# Usage: docker build --target [development|test|production|demo] .

# Build arguments
ARG NODE_VERSION=23.3.0
ARG BUN_VERSION=1.2.5
ARG TURBO_VERSION=2.3.3
ARG BUILD_TARGET=production
ARG VERSION=latest
ARG BUILD_DATE

# ============================================================================
# Base Stage - Common dependencies and setup
# ============================================================================
FROM node:${NODE_VERSION}-slim AS base

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -g 1001 eliza && \
    useradd -r -u 1001 -g eliza eliza

# Install bun and turbo globally
RUN npm install -g bun@${BUN_VERSION} turbo@${TURBO_VERSION}

# ============================================================================
# Builder Stage - Build the application
# ============================================================================
FROM base AS builder

# Install additional build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    git \
    python3 \
    g++ \
    make \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy package files for better caching
COPY package.json turbo.json tsconfig.json lerna.json renovate.json .npmrc ./
COPY scripts ./scripts
COPY packages ./packages

# Install dependencies
RUN SKIP_POSTINSTALL=1 bun install --no-cache

# Build the application
RUN bun run build

# ============================================================================
# Development Target - For dev mode with live reload
# ============================================================================
FROM base AS development

# Install additional development dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    python3 \
    vim \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy built application from builder
COPY --from=builder --chown=eliza:eliza /app/package.json ./
COPY --from=builder --chown=eliza:eliza /app/turbo.json ./
COPY --from=builder --chown=eliza:eliza /app/tsconfig.json ./
COPY --from=builder --chown=eliza:eliza /app/lerna.json ./
COPY --from=builder --chown=eliza:eliza /app/renovate.json ./
COPY --from=builder --chown=eliza:eliza /app/.npmrc ./
COPY --from=builder --chown=eliza:eliza /app/node_modules ./node_modules
COPY --from=builder --chown=eliza:eliza /app/packages ./packages
COPY --from=builder --chown=eliza:eliza /app/scripts ./scripts

# Set environment
ENV NODE_ENV=development
ENV ELIZA_DEV_MODE=true

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

USER eliza
EXPOSE 3000
EXPOSE 50000-50100/udp

CMD ["bun", "run", "dev"]

# ============================================================================
# Test Target - For running tests in isolated environment
# ============================================================================
FROM base AS test

# Install test dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    python3 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy built application from builder
COPY --from=builder --chown=eliza:eliza /app/package.json ./
COPY --from=builder --chown=eliza:eliza /app/turbo.json ./
COPY --from=builder --chown=eliza:eliza /app/tsconfig.json ./
COPY --from=builder --chown=eliza:eliza /app/lerna.json ./
COPY --from=builder --chown=eliza:eliza /app/renovate.json ./
COPY --from=builder --chown=eliza:eliza /app/.npmrc ./
COPY --from=builder --chown=eliza:eliza /app/node_modules ./node_modules
COPY --from=builder --chown=eliza:eliza /app/packages ./packages
COPY --from=builder --chown=eliza:eliza /app/scripts ./scripts

# Set environment
ENV NODE_ENV=test
ENV ELIZA_TEST_MODE=true

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

USER eliza
EXPOSE 3000
EXPOSE 50000-50100/udp

CMD ["bun", "run", "test"]

# ============================================================================
# Production Target - Optimized for production deployment
# ============================================================================
FROM base AS production

# Install minimal runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy built application from builder
COPY --from=builder --chown=eliza:eliza /app/package.json ./
COPY --from=builder --chown=eliza:eliza /app/turbo.json ./
COPY --from=builder --chown=eliza:eliza /app/tsconfig.json ./
COPY --from=builder --chown=eliza:eliza /app/lerna.json ./
COPY --from=builder --chown=eliza:eliza /app/renovate.json ./
COPY --from=builder --chown=eliza:eliza /app/.npmrc ./
COPY --from=builder --chown=eliza:eliza /app/node_modules ./node_modules
COPY --from=builder --chown=eliza:eliza /app/packages ./packages
COPY --from=builder --chown=eliza:eliza /app/scripts ./scripts

# Set environment
ENV NODE_ENV=production

# Add image metadata
LABEL maintainer="elizaOS Team"
LABEL version=${VERSION}
LABEL build-date=${BUILD_DATE}
LABEL description="elizaOS Agent Runtime - Production"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

USER eliza
EXPOSE 3000
EXPOSE 50000-50100/udp

CMD ["bun", "run", "start"]

# ============================================================================
# Demo Target - Pre-configured demo environment
# ============================================================================
FROM production AS demo

# Copy demo configuration and sample data
# Note: Demo-specific files would be added here
COPY --chown=eliza:eliza demo/ ./demo/

# Set environment
ENV NODE_ENV=production
ENV ELIZA_DEMO_MODE=true

# Add demo metadata
LABEL description="elizaOS Agent Runtime - Demo Configuration"

# Use demo start command
CMD ["bun", "run", "start:demo"]
