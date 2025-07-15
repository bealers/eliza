# elizaOS Docker Infrastructure

This directory contains Docker configurations for running elizaOS agents in containerized environments.

## Production Quick Start

```bash
elizaos start --docker
```

Which is a shortcut for:

```bash
docker-compose -f docker/targets/prod/docker-compose.yml up -d
```

### Environment Overrides

The container is provided with opnionated target-ready defaults. Create a `docker/.env.local` file to override only what you need:

```bash
# Minimal .env.local - for a production example
OPENAI_API_KEY=sk-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Optional overrides
ELIZA_UI_ENABLE=true      # Enable web UI in production (bad by default)
LOG_LEVEL=debug           # More verbose logging
POSTGRES_URL=postgres://  # Use external DB
```



### Development

```bash
# 1. Add your API keys (if not already done)
echo "OPENAI_API_KEY=sk-your-key-here" >> docker/.env.local

# 2. Start with hot reload
elizaos dev --docker
```

The `--docker` flag is a shortcut for:

```bash
docker-compose -f docker/targets/dev/docker-compose.yml up
```

## Docker Infrastructure

### Targets

| Target | Purpose | Size |
|--------|---------|------|
| `production` | Optimized runtime | 1.56GB |
| `development` | Hot reload, dev tools | ~2GB |

### Multi-Architecture

```bash
# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f targets/prod/Dockerfile \
  -t elizaos:latest .
```

### Production Secrets

For production, use proper secret management:

```yaml
# docker-compose with Docker Secrets
services:
  eliza:
    image: elizaos:production
    secrets:
      - openai_key
    environment:
      - OPENAI_API_KEY_FILE=/run/secrets/openai_key
```

## File Structure

```text
docker/
├── README.md                    # This file
├── .env.local.example           # Template for overrides
├── .env.local                   # Your overrides (gitignored)
├── env.template                 # Default environment config
├── VERSION                      # Version tracking
└── targets/
    ├── prod/
    │   ├── Dockerfile           # Production image (1.56GB)
    │   └── docker-compose.yml
    └── dev/
        ├── Dockerfile           # Development image (~2GB)
        └── docker-compose.yml
```

## Security

- `.env.local` is gitignored - never commit it
- Container runs as non-root user (eliza:1001)
- Set `ELIZA_SERVER_AUTH_TOKEN` for API security
- For production, use Docker Secrets or cloud secret managers

## Contributing

When modifying Docker infrastructure:

1. Test all targets (production, development, test)
2. Maintain override behavior in startup scripts
3. Support both arm64 and amd64 architectures
4. Update this README with changes
