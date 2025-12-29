# CPU Killer - Auto-kill High CPU Processes

Automatically kills processes that exceed a CPU threshold to prevent your Mac from overheating.

## Quick Start

### Option 1: Run Manually (Recommended for testing)

```bash
# Start the CPU killer (kills processes using >300% CPU)
./scripts/start-cpu-killer.sh

# Or run directly with custom settings
./scripts/cpu-killer.sh 200 5  # Threshold: 200% CPU, check every 5 seconds
```

### Option 2: Run on Startup (Auto-start)

```bash
# Install as a LaunchAgent (runs automatically on login)
cp scripts/com.user.cpukiller.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.user.cpukiller.plist

# To stop auto-start
launchctl unload ~/Library/LaunchAgents/com.user.cpukiller.plist
```

## Configuration

Edit the threshold and interval in `cpu-killer.sh` or pass them as arguments:

```bash
./scripts/cpu-killer.sh [threshold] [interval]
```

- **Threshold**: CPU percentage to trigger kill (default: 300% = 3 cores)
- **Interval**: Seconds between checks (default: 5)

### Recommended Settings

- **Development**: `300 5` (kills processes using >300% CPU, checks every 5s)
- **Stricter**: `200 3` (kills processes using >200% CPU, checks every 3s)
- **Lenient**: `500 10` (kills processes using >500% CPU, checks every 10s)

## How It Works

1. Monitors all processes every N seconds
2. Identifies processes exceeding CPU threshold
3. Skips critical system processes (kernel, WindowServer, etc.)
4. Kills runaway processes automatically

## Safe Processes (Never Killed)

- `kernel_task`
- `WindowServer`
- `loginwindow`
- `Dock`
- `Finder`
- `SystemUIServer`

## View Logs

```bash
# View real-time logs
tail -f ~/cpu-killer.log

# View error logs (if using LaunchAgent)
tail -f ~/cpu-killer-error.log
```

## Stop the CPU Killer

```bash
# If running manually
pkill -f cpu-killer.sh

# If running as LaunchAgent
launchctl unload ~/Library/LaunchAgents/com.user.cpukiller.plist
```

## Customization

To add more safe processes, edit `cpu-killer.sh` and add to the `SAFE_PROCESSES` array:

```bash
SAFE_PROCESSES=(
  "kernel_task"
  "WindowServer"
  "YourApp"  # Add your process here
)
```

## Warning

⚠️ This script will **force kill** processes. Make sure to:
- Test with a higher threshold first (e.g., 500%)
- Add important processes to the whitelist
- Monitor logs to see what's being killed

## Troubleshooting

**Script not working?**
- Check if it's running: `ps aux | grep cpu-killer`
- Check logs: `tail -f ~/cpu-killer.log`
- Make sure script is executable: `chmod +x scripts/cpu-killer.sh`

**Killing important processes?**
- Add them to the `SAFE_PROCESSES` array
- Increase the threshold

**Too aggressive?**
- Increase the threshold (e.g., 400% or 500%)
- Increase the interval (e.g., 10 seconds)


