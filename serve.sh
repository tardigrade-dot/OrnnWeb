#!/bin/bash

# Simple server that maps /OrnnWeb/<project>/ to dist/<project>/
# Uses Python's built-in HTTP server with custom routing

cd dist

echo "Starting server at http://localhost:8080"
echo "Access projects at: http://localhost:8080/OrnnWeb/<project-name>/"
echo ""

python3 -c "
import http.server
import socketserver
import os
import re

PORT = 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Map /OrnnWeb/<project>/... to ./<project>/...
        match = re.match(r'^/OrnnWeb/([^/]+)/(.*)$', path)
        if match:
            project = match.group(1)
            subpath = match.group(2)
            path = '/' + project + '/' + subpath
        elif path == '/' or path == '/OrnnWeb/':
            # Serve root index.html
            path = '/index.html'
        return super().translate_path(path)
    
    def log_message(self, format, *args):
        print(f'HTTP  {args[0]} {args[1]} -> {args[2]}')

with socketserver.TCPServer(('', PORT), Handler) as httpd:
    httpd.serve_forever()
"
