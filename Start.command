#!/bin/bash
# StreamHub Platform — Mac launcher
# Double-click to start. Serves the folder locally and opens the persona selector.
cd "$(dirname "$0")" || exit 1
PORT=8000
while lsof -i :$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done
echo "Starting StreamHub on http://localhost:$PORT ..."
echo "Leave this window open while using the apps. Close it to stop."
( sleep 1; open "http://localhost:$PORT/index.html" ) &
python3 -m http.server $PORT
