#!/bin/bash
set -e

# Single build script for all elizaOS Docker targets
# Usage: ./build.sh [target] [version] [additional-args]

TARGET=${1:-prod}
VERSION=${2:-latest}
BUILD_ARGS=${3:-""}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Project info
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOCKERFILE_PATH="$PROJECT_ROOT/docker/dockerfiles/Dockerfile"
BUILD_CONTEXT="$PROJECT_ROOT"

echo -e "${GREEN}🐳 Building elizaOS Docker image${NC}"
echo -e "Target: ${YELLOW}$TARGET${NC}"
echo -e "Version: ${YELLOW}$VERSION${NC}"
echo -e "Context: ${YELLOW}$BUILD_CONTEXT${NC}"

# Validate target
case $TARGET in
  dev|test|prod|demo)
    echo -e "${GREEN}✅ Valid target: $TARGET${NC}"
    ;;
  *)
    echo -e "${RED}❌ Unknown target: $TARGET${NC}"
    echo "Valid targets: dev, test, prod, demo"
    exit 1
    ;;
esac

# Set target-specific build arguments
case $TARGET in
  dev)
    BUILD_TARGET="development"
    EXTRA_ARGS="--target development"
    ;;
  test)
    BUILD_TARGET="test"
    EXTRA_ARGS="--target test"
    ;;
  prod)
    BUILD_TARGET="production"
    EXTRA_ARGS="--target production"
    ;;
  demo)
    BUILD_TARGET="demo"
    EXTRA_ARGS="--target demo"
    ;;
esac

# Build the Docker image
echo -e "${GREEN}🔨 Building image: elizaos:$TARGET-$VERSION${NC}"

docker build \
  --file "$DOCKERFILE_PATH" \
  --tag "elizaos:$TARGET-$VERSION" \
  --tag "elizaos:$TARGET-latest" \
  --build-arg BUILD_TARGET="$BUILD_TARGET" \
  --build-arg VERSION="$VERSION" \
  --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
  $EXTRA_ARGS \
  $BUILD_ARGS \
  "$BUILD_CONTEXT"

echo -e "${GREEN}✅ Successfully built elizaos:$TARGET-$VERSION${NC}"
echo -e "Tags created:"
echo -e "  - elizaos:$TARGET-$VERSION"
echo -e "  - elizaos:$TARGET-latest"
