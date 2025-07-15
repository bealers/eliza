#!/bin/bash
# Test the simple Docker approach

echo "Testing simple Docker image..."

# First create a test project locally
echo "Creating test project..."
mkdir -p /tmp/elizaos-docker-test
cd /tmp/elizaos-docker-test

# Create a minimal .env file
cat > .env << EOF
OPENAI_API_KEY=test-key-123
NODE_ENV=production
EOF

# Run the container with the env file
echo "Starting container..."
docker run --rm -d \
  --name elizaos-test \
  -v $(pwd)/.env:/app/agent/.env:ro \
  -p 3000:3000 \
  elizaos:simple-v2

# Wait for startup
echo "Waiting for startup..."
sleep 10

# Check if running
if docker ps | grep elizaos-test > /dev/null; then
    echo "✅ Container is running"
    
    # Check logs
    echo "Container logs:"
    docker logs elizaos-test --tail 20
    
    # Try to access it
    echo "Testing HTTP access..."
    curl -f http://localhost:3000 || echo "No HTTP server (might be normal)"
else
    echo "❌ Container failed to start"
    echo "Logs:"
    docker logs elizaos-test
fi

# Cleanup
echo "Cleaning up..."
docker stop elizaos-test 2>/dev/null || true
rm -rf /tmp/elizaos-docker-test

echo "Test complete!"