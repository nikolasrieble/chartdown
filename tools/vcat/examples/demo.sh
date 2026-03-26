#!/bin/bash
# Demo script for vcat — runs demos and optionally records each as a separate clip
# Usage:
#   bash examples/demo.sh              # just run all demos
#   bash examples/demo.sh --record     # run + record each demo as a separate GIF
#   bash examples/demo.sh --record 2   # record only demo #2

set -e
cd "$(dirname "$0")/.."
mkdir -p demo

RECORD=false
ONLY=""
FFMPEG_PID=""

if [ "$1" = "--record" ]; then
  RECORD=true
  ONLY="${2:-}"
fi

start_recording() {
  local name="$1"
  if [ "$RECORD" = true ]; then
    echo "demo: recording $name..."
    ffmpeg -y -f avfoundation -framerate 30 -capture_cursor 0 \
      -i "2:none" \
      -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p \
      "demo/${name}.mp4" &>/dev/null &
    FFMPEG_PID=$!
    sleep 0.5
  fi
}

stop_recording() {
  local name="$1"
  if [ -n "$FFMPEG_PID" ]; then
    kill "$FFMPEG_PID" 2>/dev/null
    wait "$FFMPEG_PID" 2>/dev/null
    FFMPEG_PID=""
    ffmpeg -y -i "demo/${name}.mp4" \
      -vf "fps=15,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
      "demo/${name}.gif" &>/dev/null
    echo "demo: saved demo/${name}.gif"
  fi
}

should_run() {
  [ -z "$ONLY" ] || [ "$ONLY" = "$1" ]
}

type_cmd() {
  local cmd="$1"
  printf "\n\033[1;32m❯\033[0m "
  for (( i=0; i<${#cmd}; i++ )); do
    printf "%s" "${cmd:$i:1}"
    sleep 0.04
  done
  sleep 0.5
  printf "\n"
  eval "$cmd"
}

pause() {
  sleep "${1:-2}"
}

# --- Demo 1: Bar chart from JSON ---
if should_run 1; then
  clear
  start_recording "1-bar"
  type_cmd "vcat examples/bar.json"
  pause 3
  stop_recording "1-bar"
fi

# --- Demo 2: Line chart from JSON ---
if should_run 2; then
  clear
  start_recording "2-line"
  type_cmd "vcat examples/line.json"
  pause 3
  stop_recording "2-line"
fi

# --- Demo 3: Auto-chart from CSV ---
if should_run 3; then
  clear
  start_recording "3-csv"
  type_cmd "cat examples/sales.csv"
  pause 1.5
  type_cmd "cat examples/sales.csv | vcat"
  pause 3
  stop_recording "3-csv"
fi

# --- Demo 4: Render charts from markdown ---
if should_run 4; then
  clear
  start_recording "4-markdown"
  type_cmd "head -20 examples/report.md"
  pause 1.5
  type_cmd "vcat examples/report.md"
  pause 3
  stop_recording "4-markdown"
fi

echo ""
echo "demo: done"
[ "$RECORD" = true ] && echo "demo: clips saved to demo/"
