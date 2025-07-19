# Lightweight Development Container for ElizaOS
# Volume mounts source code for hot reload - no build-time copying needed

FROM node:22-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Create app directory
WORKDIR /app

# Create eliza user directory structure  
RUN mkdir -p /home/eliza/agent

# Copy generic environment template
COPY docker/env.template /home/eliza/agent/.env.example

# Set git config for container
RUN git config --global --add safe.directory /app

# Default environment
ENV NODE_ENV=development
ENV LOG_LEVEL=debug
ENV DEV_MODE=true

# Expose ports
EXPOSE 3000 3001 5173 9229

# Default command - will be overridden by docker-compose
CMD ["bun", "run", "dev"]