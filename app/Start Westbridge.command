#!/bin/bash
# Double-click to open Westbridge Purchasing with the recording guide beside it.
# Runs a small local web server so the app and the guide window can talk to each other.

cd "$(dirname "$0")" || exit 1
PORT=8765
URL="http://localhost:$PORT"

if ! lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  python3 -m http.server $PORT >/dev/null 2>&1 &
  SERVER_PID=$!
  sleep 1
fi

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ -x "$CHROME" ]; then
  # App on the left (this is what you record), guide on the right.
  "$CHROME" --user-data-dir="$HOME/.westbridge-chrome" --no-first-run --no-default-browser-check --force-device-scale-factor=1.7 --app="$URL/index.html" --window-position=0,25 --window-size=1060,880 >/dev/null 2>&1 &
  sleep 1
  "$CHROME" --user-data-dir="$HOME/.westbridge-chrome" --no-first-run --no-default-browser-check --force-device-scale-factor=1.7 --app="$URL/guide.html" --window-position=1065,25 --window-size=405,880 >/dev/null 2>&1 &
else
  open "$URL/index.html"
  open "$URL/guide.html"
fi

echo ""
echo "  Westbridge Purchasing is running at $URL"
echo "  App: left window (record this one) · Guide: right window"
echo ""
echo "  Leave this window open while you work. Close it (or press Ctrl+C) to stop."
echo ""
if [ -n "$SERVER_PID" ]; then
  trap 'kill $SERVER_PID 2>/dev/null' EXIT
  wait $SERVER_PID
fi
