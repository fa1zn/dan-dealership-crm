#!/bin/bash
# Double-click launcher for Dan (macOS). Keep this window open while you use the app.
cd "$(dirname "$0")" || exit 1
clear
echo "Starting Dan..."
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  Node.js isn't installed yet. It's a one-time setup:"
  echo ""
  echo "    1) Go to  https://nodejs.org"
  echo "    2) Click the big green LTS download button and install it"
  echo "    3) Double-click START again"
  echo ""
  read -r -p "Press Enter to close this window."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First-time setup - installing (about 1-2 minutes, needs internet)..."
  npm install --no-audit --no-fund || { echo ""; echo "Setup failed. Make sure you're online, then try again."; read -r -p "Press Enter to close."; exit 1; }
fi

if [ ! -d .next ]; then
  echo "Preparing the app (first run only, about 30 seconds)..."
  npm run build || { echo ""; echo "Build failed."; read -r -p "Press Enter to close."; exit 1; }
fi

echo ""
echo "Dan is starting. Your browser will open at http://localhost:3000"
echo "Leave this window open while you use Dan. Close it to quit."
echo ""
( sleep 4 && open http://localhost:3000 ) &
npm run start
