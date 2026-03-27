#!/bin/bash

# Local deploy script for OrnnWeb
# Mimics the GitHub Actions deploy workflow

set -e

echo "🚀 Starting local build and deploy..."

# Create dist directory
mkdir -p dist

# Install dependencies
npm install

# Build with vite
npx vite build

echo ""
echo "📁 Build output:"
ls -R dist

echo ""
echo "✅ Build complete! Output is in ./dist"
echo ""
echo "To serve locally, run:"
echo "  npx http-server dist -p 8080"
echo ""
echo "Then visit: http://localhost:8080/"
