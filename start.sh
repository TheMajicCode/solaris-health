#!/bin/bash
# Quick start script - runs both backend and frontend

echo "🌅 Starting Solaris..."

# Start backend in background
cd backend
node src/server.js > /tmp/solaris-backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend
sleep 2
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Backend failed to start. Check /tmp/solaris-backend.log"
    exit 1
fi
echo "✓ Backend running (PID: $BACKEND_PID)"

# Start frontend
echo "✓ Starting frontend..."
npx vite

# Cleanup on exit
trap "kill $BACKEND_PID 2>/dev/null" EXIT
