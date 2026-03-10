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

# Remove subproject dist and node_modules
for dir in */; do
    if [ -d "${dir}dist" ]; then
        rm -rf "${dir}dist"
        echo -e "${GREEN}✓${NC} Removed ${dir}dist"
        ((removed_count++))
    fi
    if [ -d "${dir}node_modules" ]; then
        rm -rf "${dir}node_modules"
        echo -e "${GREEN}✓${NC} Removed ${dir}node_modules"
        ((removed_count++))
    fi
done

echo -e "${GREEN}✅ Cleanup complete! Removed ${removed_count} directories.${NC}"