#!/bin/bash
# Self-contained: opens Ghostty, records the demo, exits
# Run from ANY terminal: bash examples/run-demo.sh

cd "$(dirname "$0")/.."
/Applications/Ghostty.app/Contents/MacOS/ghostty -e "bash -lc 'cd $(pwd) && bash examples/demo.sh --record; sleep 2; exit'"
