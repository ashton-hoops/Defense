#!/bin/bash

# OU Defense Analytics Launcher
# This script starts the backend server and frontend UI

# Set OpenAI API key for semantic search
export OPENAI_API_KEY='your-api-key-here'

# Navigate to project directory
cd "$(dirname "$0")"

echo "🏀 OU Defense Analytics Starting..."

# Auto-backup database
if [ -f "data/analytics.sqlite" ]; then
    BACKUP_DIR="backups"
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    cp "data/analytics.sqlite" "$BACKUP_DIR/analytics_${TIMESTAMP}.sqlite"
    echo "✅ Database backed up to $BACKUP_DIR/analytics_${TIMESTAMP}.sqlite"

    # Keep only last 10 backups
    ls -t "$BACKUP_DIR"/analytics_*.sqlite | tail -n +11 | xargs rm -f 2>/dev/null
fi

# Kill any existing processes on ports 8000 and 5175
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:5175 | xargs kill -9 2>/dev/null

# Start backend server
echo "🚀 Starting backend server..."
python3 media_server.py > /tmp/defense_backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Start frontend
echo "🎨 Starting frontend UI..."
cd ui
npm run dev > /tmp/defense_frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 3

# Open browser
echo "🌐 Opening browser..."
open "http://localhost:5175"

echo ""
echo "✅ OU Defense Analytics is running!"
echo "📊 Dashboard: http://localhost:5175"
echo "🔧 Backend: http://localhost:8000"
echo "🤖 AI Search: Enabled"
echo ""
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "Press Ctrl+C to stop or just close this window."
echo ""
echo "Logs:"
echo "  Backend:  tail -f /tmp/defense_backend.log"
echo "  Frontend: tail -f /tmp/defense_frontend.log"
echo ""

# Keep terminal open and wait for Ctrl+C
trap "echo ''; echo '🛑 Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# Wait forever (until Ctrl+C)
while true; do
    sleep 1
done
