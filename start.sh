#!/bin/bash

# PDF Personalizer - Development Server Startup Script

echo "🚀 Starting PDF Personalizer..."
echo ""

# Check if Python venv exists
if [ ! -d ".venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv .venv
fi

# Activate venv and install dependencies
echo "📦 Installing Python dependencies..."
source .venv/bin/activate
pip install -q -r requirements.txt
pip install -q pywhatkit  # For WhatsApp

# Create storage directories
mkdir -p storage/uploads storage/outputs storage/previews

# Start backend in background
echo "🔧 Starting FastAPI backend on http://localhost:8000..."
cd /home/thommas/Desktop/Project_B
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend
echo "🎨 Starting React frontend on http://localhost:5173..."
cd frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ PDF Personalizer is running!"
echo ""
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers."

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo ''; echo '👋 Goodbye!'; exit 0" SIGINT
wait
