# elizaOS Docker Infrastructure

Docker targets for elizaOS providing a standardized and reproducible environment for multiple use cases.

## One Time Set-up

Create a `.env.local` in `docker/` to set secrets and to override target defaults.

```bash
cat > docker/.env.local << EOF
OPENAI_API_KEY=sk-your-key
ANTHROPIC_API_KEY=sk-ant-your-key  
EOF
```
 
## Development Container

```bash
# Start development container
elizaos dev --docker
```

This gets you the monorepo mounted inside in a pristine environment with Postgres, pgvector and some standard build tools.
- Runs `bun run dev` automatically
- Includes PostgreSQL cli client
- Exposes ports: 3000 (web UI), 5173 (Vite), 9229 (Node debugger)


```bash
# View logs
docker logs -f elizaos-dev

# Shell access
docker exec -it elizaos-dev /bin/bash

# Run tests
docker exec elizaos-dev bun test

# Stop
docker-compose -f docker/targets/dev/docker-compose.yml down
```

## Production Ready

```bash
# Start production container
elizaos start --docker

# Force rebuild image
elizaos start --docker --build
```

This gives you a production ready container, optimized for security and reduced image size.
- PostgreSQL with pgvector
- Pre-installed plugins: bootstrap, openai, anthropic, sql
- Web UI at http://localhost:3000
- **Use `--build`**: Force rebuild for registry deployment or after code changes


**Note:** If the web UI returns `Forbidden` make sure to set `ELIZA_UI_ENABLE=true` in your `.env.local` as by default the UI is disabled in production.


### Production Image Analysis

**Size Breakdown (1.6GB total)**
- Base Node.js slim: 346MB
- Bun runtime: ~188MB (94MB binary + 94MB modules)
- ElizaOS packages: ~678MB (CLI + plugins)
- System dependencies: ~400MB (Python, FFmpeg, Git)

**🔧 TODO: Optimization with docker-slim - Real Results**

[docker-slim](https://github.com/slimtoolkit/slim) successfully reduced our production image:

```bash
# Install docker-slim (via Homebrew on macOS)
brew install docker-slim

# Run optimization
slim build --target elizaos:production-postgres \
  --tag elizaos:production-slim \
  --http-probe=false \
  --continue-after 5

# Results:
# Original: 1.62GB
# Slimmed: 450MB (72% reduction, 3.6X smaller)
## Currently Broken ##
```


**Future Optimization Strategies**
- **Distroless images**: Remove shell/package managers (~100MB savings)
- **Alpine Linux**: 50-70% size reduction but bun/node compatibility issues
- **Multi-stage copying**: Only copy exact binaries needed
- **Layer squashing**: Combine layers to reduce overhead


## Testing

### Quick Test

Run the CLI Docker test framework to validate everything works:

```bash
# From workspace/elizaos directory
bun run docker/scripts/cli-docker-test.ts
```

This validates:
- CLI commands are working
- Docker containers start successfully
- Services are accessible on expected ports
- Images build correctly

### Manual Testing

```bash
# Start production container  
elizaos start --docker

# Check it's running
docker ps | grep elizaos-prod

# Access web UI
open http://localhost:3000

# Stop when done
docker-compose -f docker/targets/prod/docker-compose.yml down
```

## Documentation Server

```bash
# Build and serve documentation
docker-compose -f docker/targets/docs/docker-compose.yml up

# Access at http://localhost:3000
```

The docs container:
- Uses nginx for efficient static serving
- Multi-stage build for minimal final image (~30MB)
- Includes only built documentation files

## Folder Structure

```
docker/
├── env.template                 # Default environment
├── .env.local                   # Your API keys and overrides (gitignored)
└── targets/
    ├── dev/                     # Development setup
    ├── prod/                    # Production tuned
    └── docs/                    # Documentation server
```