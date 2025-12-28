#!/bin/bash

# Simple wrapper to start CPU killer in background
# Usage: ./start-cpu-killer.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$HOME/cpu-killer.log"

# Default settings
THRESHOLD=250  # Kill processes using >250% CPU (2.5 cores) - catches runaway processes early
INTERVAL=5     # Check every 5 seconds

echo "Starting CPU Killer..."
echo "Threshold: ${THRESHOLD}% CPU"
echo "Log file: $LOG_FILE"
echo "To stop: pkill -f cpu-killer.sh"

# Run in background and log output
nohup "$SCRIPT_DIR/cpu-killer.sh" "$THRESHOLD" "$INTERVAL" >> "$LOG_FILE" 2>&1 &

echo "CPU Killer started in background (PID: $!)"
echo "View logs: tail -f $LOG_FILE"

