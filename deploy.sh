#!/bin/bash

# Local deploy script for OrnnWeb
# Mimics the GitHub Actions deploy workflow

set -e

echo "🚀 Starting local build and deploy..."

# Create dist directory
mkdir -p dist

# Copy root index.html
if [ -f index.html ]; then
    cp index.html dist/
    echo "✅ Copied root index.html"
fi

# Build all subprojects
for dir in */; do
    name=${dir%/}
    
    if [ $name == "test" ]; then
        echo "⏭️  Skipping $name (test)"
        continue
    fi
    # Skip directories without package.json
    if [ ! -f "$name/package.json" ]; then
        echo "⏭️  Skipping $name (no package.json)"
        continue
    fi
    
    echo "🔨 Building $name..."
    cd "$name"

    # Install dependencies
    npm install --silent

    # Build with vite
    npx vite build --base=/OrnnWeb/$name/

    cd ..
    
    # Copy build output to dist
    mkdir -p dist/$name
    cp -r "$name/dist/." dist/$name/
    
    echo "✅ Built $name"
done

echo ""
echo "📁 Build output:"
ls -R dist

echo ""
echo "✅ Build complete! Output is in ./dist"
echo ""
echo "To serve locally, run:"
echo "  npx http-server dist -p 8080"
echo ""
echo "Then visit: http://localhost:8080/OrnnWeb/<project-name>/"
