#!/bin/bash

# Defense Analytics Launcher
# Double-click this file to start the app

# Get the directory where this script is located
cd "$(dirname "$0")"

echo "🏀 Starting OU Defense Analytics..."
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    # Kill any processes on ports 8000, 5002, 5173, 5175, 5176
    lsof -ti:8000 | xargs kill -9 2>/dev/null
    lsof -ti:5002 | xargs kill -9 2>/dev/null
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    lsof -ti:5175 | xargs kill -9 2>/dev/null
    lsof -ti:5176 | xargs kill -9 2>/dev/null
    echo "✅ Servers stopped"
    exit 0
}

# Set up cleanup on script exit
trap cleanup EXIT INT TERM

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed"
    echo "Please install Python 3 from https://www.python.org/downloads/"
    read -p "Press Enter to exit..."
    exit 1
fi

# Check if Node is available
if ! command -v npm &> /dev/null; then
    echo "❌ Node.js/npm is not installed"
    echo "Please install Node.js from https://nodejs.org/"
    read -p "Press Enter to exit..."
    exit 1
fi

# Kill any existing servers on these ports
echo "🧹 Cleaning up old server instances..."
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:5002 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
lsof -ti:5175 | xargs kill -9 2>/dev/null
lsof -ti:5176 | xargs kill -9 2>/dev/null
sleep 1

# Backup database
echo "💾 Creating database backup..."
python3 backup_database.py > /dev/null 2>&1
echo "✅ Database backed up"

# Start Python backend
echo "🐍 Starting Python backend server..."
python3 media_server.py > /tmp/defense_backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Wait for backend to start (with retries)
echo "⏳ Waiting for backend to start..."
for i in {1..10}; do
    if lsof -ti:8000 > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

# Check if backend started successfully
if ! lsof -ti:8000 > /dev/null 2>&1; then
    echo "❌ Backend failed to start. Check /tmp/defense_backend.log for errors"
    read -p "Press Enter to exit..."
    exit 1
fi

echo "✅ Backend running on http://localhost:8000"

# Start Clip Extractor service
echo "✂️  Starting Clip Extractor service..."
python3 clip_extractor.py > /tmp/defense_extractor.log 2>&1 &
EXTRACTOR_PID=$!
echo "   Extractor PID: $EXTRACTOR_PID"

# Wait for extractor to start
echo "⏳ Waiting for clip extractor to start..."
for i in {1..10}; do
    if lsof -ti:5002 > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

if ! lsof -ti:5002 > /dev/null 2>&1; then
    echo "❌ Clip Extractor failed to start. Check /tmp/defense_extractor.log for errors"
    read -p "Press Enter to exit..."
    exit 1
fi

echo "✅ Clip Extractor running on http://localhost:5002"

# Start React frontend
echo "⚛️  Starting React frontend..."
cd ui
npm run dev > /tmp/defense_frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
echo "   Frontend PID: $FRONTEND_PID"

# Wait for frontend to start and detect the port
echo "⏳ Waiting for frontend to start..."
sleep 6

# Extract the port from the log file
FRONTEND_PORT=$(grep -oE "localhost:[0-9]+" /tmp/defense_frontend.log | head -1 | cut -d: -f2)

if [ -z "$FRONTEND_PORT" ]; then
    echo "❌ Frontend failed to start. Check /tmp/defense_frontend.log for errors"
    read -p "Press Enter to exit..."
    exit 1
fi

echo "✅ Frontend running on http://localhost:$FRONTEND_PORT"
echo ""
echo "🎉 Defense Analytics is ready!"
echo "📱 Opening browser..."
echo ""

# Open browser
sleep 2
open "http://localhost:$FRONTEND_PORT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ App is running!"
echo ""
echo "Backend:        http://localhost:8000"
echo "Clip Extractor: http://localhost:5002"
echo "Frontend:       http://localhost:$FRONTEND_PORT"
echo ""
echo "📋 Logs:"
echo "   Backend:   /tmp/defense_backend.log"
echo "   Extractor: /tmp/defense_extractor.log"
echo "   Frontend:  /tmp/defense_frontend.log"
echo ""
echo "⚠️  KEEP THIS WINDOW OPEN"
echo "   Closing it will stop the servers"
echo ""
echo "To stop: Press Ctrl+C or close this window"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Keep the script running
wait
