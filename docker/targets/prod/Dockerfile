# Production-optimized Dockerfile for elizaOS
# Multi-stage build tweaked for minimal image size

ARG NODE_VERSION=23.3.0
ARG BUN_VERSION=1.2.5
ARG ELIZAOS_VERSION=latest

# Stage 1: Base dependencies - rarely changes, cached effectively
FROM node:${NODE_VERSION}-slim AS base-deps

# Install only the most essential runtime dependencies in one layer
# Order: least likely to change -> most likely to change
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Stage 2: System dependencies - changes occasionally
FROM base-deps AS system-deps

# Combine all system dependency installation to minimize layers
# Use && to chain commands and || for fallbacks
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    curl \
    git \
    ffmpeg \
    python3 \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Stage 3: Bun installation - version specific
FROM base-deps AS bun-installer

# Install curl temporarily just for bun installation
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

ARG BUN_VERSION
# Install bun globally
RUN npm install -g bun@${BUN_VERSION} \
    && bun --version

# Stage 4: User setup - reusable across builds
FROM base-deps AS user-setup

# Create non-root user with fixed UID/GID for consistency
RUN groupadd -g 1001 eliza \
    && useradd -r -u 1001 -g eliza -m -d /home/eliza -s /bin/bash eliza

# Stage 5: ElizaOS installation
FROM bun-installer AS elizaos-installer

# Copy user from user-setup stage
COPY --from=user-setup /etc/passwd /etc/passwd
COPY --from=user-setup /etc/group /etc/group
COPY --from=user-setup --chown=eliza:eliza /home/eliza /home/eliza

# Switch to non-root user for package installation
USER eliza
WORKDIR /home/eliza

# Install elizaOS with specific version
ARG ELIZAOS_VERSION
RUN bun install -g @elizaos/cli@${ELIZAOS_VERSION} \
    && mkdir -p /home/eliza/agent

# Stage 6: Configuration setup
FROM base-deps AS config-builder

WORKDIR /tmp
# Copy the env template
COPY docker/env.template .env.example

# Create startup script with proper shell handling
RUN cat > start.sh << 'SCRIPT_END'
#!/bin/bash
set -e

cd /home/eliza/agent

# Create .env from template if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env from template..."
    cp .env.example .env
fi

# Apply .env.local overrides if it exists
if [ -f .env.local ]; then
    echo "Applying .env.local overrides..."
    # Source both files and merge, with .env.local taking precedence
    set -a  # Auto-export variables
    source .env
    source .env.local
    set +a
    
    # Write merged environment back to .env for elizaOS
    env | grep -E '^[A-Z_]+=' | sort > .env.merged
    mv .env.merged .env
else
    # Apply Docker environment variable overrides if no .env.local
    [ -n "${NODE_ENV}" ] && sed -i "s/NODE_ENV=.*/NODE_ENV=${NODE_ENV}/" .env
    [ -n "${LOG_LEVEL}" ] && sed -i "s/LOG_LEVEL=.*/LOG_LEVEL=${LOG_LEVEL}/" .env
    [ -n "${ELIZA_UI_ENABLE}" ] && sed -i "s/ELIZA_UI_ENABLE=.*/ELIZA_UI_ENABLE=${ELIZA_UI_ENABLE}/" .env
    [ -n "${OPENAI_API_KEY}" ] && sed -i "s/OPENAI_API_KEY=.*/OPENAI_API_KEY=${OPENAI_API_KEY}/" .env
    [ -n "${ANTHROPIC_API_KEY}" ] && sed -i "s/ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}/" .env
    [ -n "${POSTGRES_URL}" ] && sed -i "s|#POSTGRES_URL=.*|POSTGRES_URL=${POSTGRES_URL}|" .env
    [ -n "${ELIZA_SERVER_AUTH_TOKEN}" ] && sed -i "s/ELIZA_SERVER_AUTH_TOKEN=.*/ELIZA_SERVER_AUTH_TOKEN=${ELIZA_SERVER_AUTH_TOKEN}/" .env
fi

echo "Starting ElizaOS agent..."
exec /home/eliza/.bun/bin/elizaos start "$@"
SCRIPT_END

RUN chmod +x start.sh

# Stage 7: Final runtime image - combine all pieces
FROM base-deps AS runtime

# Copy runtime binaries from system-deps
COPY --from=system-deps /usr/bin/dumb-init /usr/bin/dumb-init
COPY --from=system-deps /usr/bin/python3 /usr/bin/python3
COPY --from=system-deps /usr/bin/python /usr/bin/python
COPY --from=system-deps /usr/bin/git /usr/bin/git
COPY --from=system-deps /usr/bin/ffmpeg /usr/bin/ffmpeg

# Copy shared libraries - handle both architectures
COPY --from=system-deps /usr/lib/*-linux-gnu*/libpython* /usr/lib/
COPY --from=system-deps /usr/lib/*-linux-gnu*/libav* /usr/lib/
COPY --from=system-deps /usr/lib/*-linux-gnu*/libsw* /usr/lib/
COPY --from=system-deps /usr/lib/*-linux-gnu*/libpostproc* /usr/lib/
COPY --from=system-deps /usr/lib/*-linux-gnu*/libgit* /usr/lib/

# Update library cache
RUN ldconfig 2>/dev/null || true

# Copy bun installation
COPY --from=bun-installer /usr/local/bin/bun /usr/local/bin/bun
COPY --from=bun-installer /usr/local/lib/node_modules/bun /usr/local/lib/node_modules/bun

# Copy user setup
COPY --from=user-setup /etc/passwd /etc/passwd
COPY --from=user-setup /etc/group /etc/group
COPY --from=user-setup --chown=eliza:eliza /home/eliza /home/eliza

# Copy elizaOS installation
COPY --from=elizaos-installer --chown=eliza:eliza /home/eliza/.bun /home/eliza/.bun

# Copy configuration files
COPY --from=config-builder --chown=eliza:eliza /tmp/.env.example /home/eliza/agent/.env.example
COPY --from=config-builder --chown=eliza:eliza /tmp/start.sh /home/eliza/start.sh

# Set runtime user and workdir
USER eliza
WORKDIR /home/eliza/agent

# Expose default port
EXPOSE 3000

# Add health check using wget (included in slim images)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

# Set default environment variables
ENV NODE_ENV=production \
    LOG_LEVEL=info

# Use dumb-init for signal handling
ENTRYPOINT ["dumb-init", "--"]

# Run the startup script
CMD ["/bin/bash", "/home/eliza/start.sh"]