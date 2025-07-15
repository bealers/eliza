#!/bin/bash
# Test script for baseline Docker build
# Run from eliza-fork root: bash docker/scripts/test-baseline.sh

set -e

echo "🐳 Testing elizaOS baseline Docker build..."
echo "Working directory: $(pwd)"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker daemon is not running. Please start Docker Desktop."
    exit 1
fi

# Build the baseline image
echo "📦 Building baseline image..."
time docker build -f docker/dockerfiles/Dockerfile.baseline -t elizaos:baseline .

# Check image size
echo "📏 Image size:"
docker images elizaos:baseline --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"

# Test basic functionality
echo "🧪 Testing container startup..."
docker run --rm -d --name test-elizaos -p 3000:3000 elizaos:baseline

# Wait for startup
echo "⏳ Waiting for container to initialize (10s)..."
sleep 10

# Check if running
if docker ps | grep test-elizaos > /dev/null; then
    echo "✅ Container is running"
    
    # Check logs
    echo "📝 Container logs:"
    docker logs test-elizaos --tail 20
    
    # Try health check
    echo "🏥 Testing health endpoint..."
    curl -f http://localhost:3000/health || echo "⚠️  Health check not available (may be normal)"
    
    # Cleanup
    echo "🧹 Cleaning up..."
    docker stop test-elizaos
else
    echo "❌ Container failed to start"
    echo "📝 Container logs:"
    docker logs test-elizaos
    docker rm test-elizaos
    exit 1
fi

echo "✅ Baseline test complete!"