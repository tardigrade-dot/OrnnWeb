#!/bin/bash

# Simple server for OrnnWeb SPA
# Uses Python's built-in HTTP server

cd dist

echo "Starting server at http://localhost:8080"
echo "Access the app at: http://localhost:8080/"
echo ""

python3 -m http.server 8080
