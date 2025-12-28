#!/bin/bash

# CPU Killer Script - Auto-kills processes exceeding CPU threshold
# Usage: ./cpu-killer.sh [threshold] [check_interval]
# Example: ./cpu-killer.sh 200 5  (kills processes using >200% CPU, checks every 5 seconds)

THRESHOLD=${1:-250}  # Default: 250% CPU (2.5 cores) - catches runaway processes early
INTERVAL=${2:-5}     # Default: check every 5 seconds

# Processes to NEVER kill (whitelist)
SAFE_PROCESSES=(
  "kernel_task"
  "WindowServer"
  "loginwindow"
  "Dock"
  "Finder"
  "SystemUIServer"
)

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "${GREEN}🚀 CPU Killer started${NC}"
echo "Threshold: ${THRESHOLD}% CPU"
echo "Check interval: ${INTERVAL} seconds"
echo "Press Ctrl+C to stop"
echo ""

while true; do
  # Get processes using more than threshold CPU
  # ps aux shows %CPU as a percentage (can be >100% on multi-core systems)
  ps aux | awk -v threshold="$THRESHOLD" '
    NR > 1 && $3 > threshold {
      # Skip header, print PID and command
      print $2, $11, $3
    }
  ' | while read -r pid command cpu; do
    # Skip if empty
    [ -z "$pid" ] && continue
    
    # Get process name
    proc_name=$(ps -p "$pid" -o comm= 2>/dev/null)
    
    # Check if process is in whitelist
    is_safe=false
    for safe_proc in "${SAFE_PROCESSES[@]}"; do
      if [[ "$proc_name" == "$safe_proc" ]]; then
        is_safe=true
        break
      fi
    done
    
    if [ "$is_safe" = false ]; then
      echo "${YELLOW}⚠️  Killing process: $proc_name (PID: $pid) - CPU: ${cpu}%${NC}"
      kill -9 "$pid" 2>/dev/null
      
      if [ $? -eq 0 ]; then
        echo "${GREEN}✓ Killed $proc_name (PID: $pid)${NC}"
      else
        echo "${RED}✗ Failed to kill $proc_name (PID: $pid)${NC}"
      fi
    else
      echo "${YELLOW}⚠️  Skipping safe process: $proc_name (PID: $pid) - CPU: ${cpu}%${NC}"
    fi
  done
  
  sleep "$INTERVAL"
done

