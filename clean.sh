#!/bin/bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "🧹 Starting cleanup..."

# Track removed items
removed_count=0

# Remove root dist
if [ -d "./dist" ]; then
    rm -rf ./dist
    echo -e "${GREEN}✓${NC} Removed ./dist"
    ((removed_count++))
fi

# Remove root node_modules (optional - usually you don't want to remove node_modules)
# Keeping this commented out to avoid accidental removal
# if [ -d "./node_modules" ]; then
#     rm -rf ./node_modules
#     echo -e "${GREEN}✓${NC} Removed ./node_modules"
#     ((removed_count++))
# fi

echo -e "${GREEN}✅ Cleanup complete! Removed ${removed_count} directories.${NC}"
