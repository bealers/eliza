# Development Dockerfile for elizaOS
# Includes development tools, hot reload support, and debugging capabilities

ARG NODE_VERSION=23.3.0
ARG BUN_VERSION=1.2.5

# Development image with all tools
FROM node:${NODE_VERSION}-slim

# Install system dependencies including dev tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Runtime dependencies
    ca-certificates \
    dumb-init \
    curl \
    git \
    ffmpeg \
    python3 \
    # Development tools
    build-essential \
    vim \
    htop \
    net-tools \
    iputils-ping \
    procps \
    # Debugging tools
    strace \
    tcpdump \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Install bun
ARG BUN_VERSION
RUN npm install -g bun@${BUN_VERSION} \
    && bun --version

# Install global development tools
RUN bun install -g \
    typescript \
    tsx \
    nodemon \
    @biomejs/biome \
    prettier

# Create non-root user for development
RUN groupadd -g 1001 eliza \
    && useradd -r -u 1001 -g eliza -m -d /home/eliza -s /bin/bash eliza

# Set up development workspace
WORKDIR /app

# Copy package files for dependency installation
# This layer will be cached unless dependencies change
COPY --chown=eliza:eliza package.json bun.lock* turbo.json lerna.json ./
COPY --chown=eliza:eliza packages/*/package.json ./packages/

# Install dependencies as eliza user
USER eliza
RUN bun install --frozen-lockfile || bun install

# Switch back to root for final setup
USER root

# Copy the env template
COPY docker/env.template /home/eliza/agent/.env.example

# Create development startup script
RUN cat > /home/eliza/start-dev.sh << 'SCRIPT_END'
#!/bin/bash
set -e

# Ensure we're in the app directory
cd /app

# Create agent directory if it doesn't exist
mkdir -p /home/eliza/agent

# Handle environment configuration
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
    env | grep -E '^[A-Z_]+=' | grep -v '^PATH=' | grep -v '^HOME=' | grep -v '^USER=' | sort > .env.merged
    mv .env.merged .env
else
    # Apply Docker environment variable overrides if no .env.local
    echo "Applying environment variable overrides..."
    [ -n "${NODE_ENV}" ] && sed -i "s/NODE_ENV=.*/NODE_ENV=${NODE_ENV}/" .env
    [ -n "${LOG_LEVEL}" ] && sed -i "s/LOG_LEVEL=.*/LOG_LEVEL=${LOG_LEVEL}/" .env
    [ -n "${ELIZA_UI_ENABLE}" ] && sed -i "s/ELIZA_UI_ENABLE=.*/ELIZA_UI_ENABLE=${ELIZA_UI_ENABLE}/" .env
    [ -n "${OPENAI_API_KEY}" ] && sed -i "s/OPENAI_API_KEY=.*/OPENAI_API_KEY=${OPENAI_API_KEY}/" .env
    [ -n "${ANTHROPIC_API_KEY}" ] && sed -i "s/ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}/" .env
    [ -n "${POSTGRES_URL}" ] && sed -i "s|#POSTGRES_URL=.*|POSTGRES_URL=${POSTGRES_URL}|" .env
    [ -n "${ELIZA_SERVER_AUTH_TOKEN}" ] && sed -i "s/ELIZA_SERVER_AUTH_TOKEN=.*/ELIZA_SERVER_AUTH_TOKEN=${ELIZA_SERVER_AUTH_TOKEN}/" .env
fi

# Development specific overrides
echo "Applying development defaults..."
sed -i "s/NODE_ENV=.*/NODE_ENV=development/" .env
sed -i "s/ELIZA_UI_ENABLE=.*/ELIZA_UI_ENABLE=true/" .env
[ -z "${LOG_LEVEL}" ] && sed -i "s/LOG_LEVEL=.*/LOG_LEVEL=debug/" .env

# Copy .env to the app directory for the dev server
cp .env /app/.env

# Return to app directory
cd /app

# Check if we should run a specific command or start dev server
if [ $# -gt 0 ]; then
    echo "Running command: $@"
    exec "$@"
else
    echo "Starting ElizaOS development server..."
    exec bun run dev
fi
SCRIPT_END

RUN chmod +x /home/eliza/start-dev.sh

# Create .bashrc for better dev experience
RUN cat > /home/eliza/.bashrc << 'EOF'
# Development environment
export PS1='\[\033[01;32m\]eliza-dev\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ '
alias ll='ls -la'
alias logs='tail -f /app/logs/*.log'
alias restart='bun run dev'

# Node/Bun helpers
export NODE_ENV=development
export PATH="/home/eliza/.bun/bin:$PATH"

# Welcome message
echo "🚀 ElizaOS Development Container"
echo "📁 Workspace: /app"
echo "🔧 Commands: bun run dev, bun test, bun run build"
echo ""
EOF

# Set proper ownership
RUN chown -R eliza:eliza /home/eliza

# Switch to eliza user
USER eliza
WORKDIR /app

# Expose common development ports
EXPOSE 3000 3001 5173 8080 9229

# Health check for development
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Development environment defaults
ENV NODE_ENV=development \
    LOG_LEVEL=debug \
    ELIZA_UI_ENABLE=true \
    # Enable Node.js debugging
    NODE_OPTIONS="--enable-source-maps" \
    # Bun development settings
    BUN_RUNTIME_TRANSPILER=1

# Volume mount points for development
# Source code will be mounted here
VOLUME ["/app"]
# Agent data persistence
VOLUME ["/home/eliza/agent/data"]

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Run the development startup script
CMD ["/bin/bash", "/home/eliza/start-dev.sh"]