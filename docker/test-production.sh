#!/bin/bash
# Test production Docker setup

echo "🧪 Testing production Docker setup..."

# Build the image
echo "📦 Building production image..."
docker build -f docker/dockerfiles/Dockerfile.production -t elizaos:production .

# Check size
echo "📏 Image size:"
docker images elizaos:production --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"

# Create test environment
echo "🔧 Setting up test environment..."
mkdir -p /tmp/elizaos-prod-test
cd /tmp/elizaos-prod-test

# Create a minimal .env for testing
cat > .env << EOF
# Minimal configuration for testing
NODE_ENV=production
SERVER_PORT=3000

# Add your API keys here
OPENAI_API_KEY=${OPENAI_API_KEY:-sk-test-key}
# ANTHROPIC_API_KEY=your-key-here

# Optional: Use PostgreSQL instead of SQLite
# POSTGRES_URL=postgresql://user:pass@localhost:5432/eliza
EOF

# Run the container
echo "🚀 Starting container..."
docker run --rm -d \
  --name elizaos-prod-test \
  -v $(pwd)/.env:/home/eliza/agent/.env:ro \
  -p 3000:3000 \
  -e OPENAI_API_KEY="${OPENAI_API_KEY:-sk-test-key}" \
  elizaos:production

# Wait for startup
echo "⏳ Waiting for startup (30s)..."
sleep 30

# Check status
if docker ps | grep elizaos-prod-test > /dev/null; then
    echo "✅ Container is running"
    
    # Show logs
    echo -e "\n📝 Container logs:"
    docker logs elizaos-prod-test --tail 30
    
    # Test API
    echo -e "\n🌐 Testing API endpoints:"
    echo -n "  Ping: "
    curl -s http://localhost:3000/api/server/ping && echo " ✅" || echo " ❌"
    
    echo -n "  Agents: "
    curl -s http://localhost:3000/api/agents | head -c 50 && echo "..."
    
else
    echo "❌ Container failed to start"
    echo "📝 Logs:"
    docker logs elizaos-prod-test
fi

# Cleanup
echo -e "\n🧹 Cleaning up..."
docker stop elizaos-prod-test 2>/dev/null || true
rm -rf /tmp/elizaos-prod-test

echo "✅ Test complete!"