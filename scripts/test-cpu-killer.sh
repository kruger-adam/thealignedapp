#!/bin/bash

# Test script for CPU Killer
# This creates a temporary high-CPU process to test if the killer catches it

echo "🧪 Testing CPU Killer..."
echo ""
echo "This will:"
echo "1. Start the CPU killer (250% threshold)"
echo "2. Spawn a test process that uses ~400% CPU"
echo "3. Wait 10 seconds to see if it gets killed"
echo ""

# Start CPU killer in background
./scripts/start-cpu-killer.sh
sleep 2

echo "📊 Starting test process (will use ~400% CPU)..."
echo ""

# Create a CPU-intensive process (infinite loop doing math)
(
  while true; do
    # This will use significant CPU
    for i in {1..100000}; do
      result=$((i * 2))
    done
  done
) &
TEST_PID=$!

echo "Test process started (PID: $TEST_PID)"
echo "Monitoring for 15 seconds..."
echo ""

# Monitor the process
for i in {1..15}; do
  if ! ps -p $TEST_PID > /dev/null 2>&1; then
    echo "✅ SUCCESS! Test process was killed by CPU killer!"
    echo "   Process was terminated after ~$((i-1)) seconds"
    exit 0
  fi
  
  # Show current CPU usage
  CPU=$(ps -p $TEST_PID -o %cpu= 2>/dev/null | xargs)
  if [ ! -z "$CPU" ]; then
    echo "  [$i/15] Test process CPU: ${CPU}% (still running...)"
  fi
  
  sleep 1
done

# If we get here, the process wasn't killed
if ps -p $TEST_PID > /dev/null 2>&1; then
  echo "❌ FAILED! Test process is still running"
  echo "   CPU Killer may not be working, or threshold is too high"
  echo "   Killing test process manually..."
  kill -9 $TEST_PID 2>/dev/null
  exit 1
else
  echo "✅ Test process was killed (outside monitoring window)"
fi


