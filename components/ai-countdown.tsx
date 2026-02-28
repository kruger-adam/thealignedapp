'use client';

import { useState, useEffect } from 'react';
import { Bot, Sparkles, Loader2 } from 'lucide-react';

// The cron jobs run at 9:00 AM Eastern time (America/Toronto)
const CRON_HOUR = 9; // 9:00 AM
const CRON_TIMEZONE = 'America/Toronto';

// How long to show "dropping now" message while cron is executing (in seconds)
const DROPPING_NOW_DURATION = 60;

// How long to show "just dropped" message after posting (in minutes)
const JUST_DROPPED_DURATION = 5;

function getNextCronTime(): Date {
  const now = new Date();
  
  // Get current Toronto time components
  const torontoTime = new Date(now.toLocaleString('en-US', { timeZone: CRON_TIMEZONE }));
  
  // Create target time for today at CRON_HOUR in Toronto
  const targetToday = new Date(torontoTime);
  targetToday.setHours(CRON_HOUR, 0, 0, 0);
  
  // Calculate the offset between Toronto time and UTC
  // by comparing the Toronto-interpreted time with actual now
  const torontoOffset = torontoTime.getTime() - now.getTime();
  
  // Convert target Toronto time back to UTC
  let targetUTC = new Date(targetToday.getTime() - torontoOffset);
  
  // If we've already passed today's cron time, move to tomorrow
  if (now >= targetUTC) {
    targetUTC = new Date(targetUTC.getTime() + 24 * 60 * 60 * 1000);
  }
  
  return targetUTC;
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '0s';
  
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

type CountdownState = 'countdown' | 'dropping' | 'dropped';

export function AICountdown() {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [state, setState] = useState<CountdownState>('countdown');

  useEffect(() => {
    function updateCountdown() {
      const now = new Date();
      const nextCron = getNextCronTime();
      const remaining = nextCron.getTime() - now.getTime();
      
      // Calculate time since the last cron run
      const msInDay = 24 * 60 * 60 * 1000;
      const msSinceCron = msInDay - remaining;
      
      // Determine state based on time since cron
      if (msSinceCron >= 0 && msSinceCron < DROPPING_NOW_DURATION * 1000) {
        // First 60 seconds: "dropping now" while cron executes
        setState('dropping');
      } else if (msSinceCron >= DROPPING_NOW_DURATION * 1000 && msSinceCron < JUST_DROPPED_DURATION * 60 * 1000) {
        // After 60 seconds up to 5 minutes: "just dropped"
        setState('dropped');
      } else {
        // Otherwise: show countdown
        setState('countdown');
      }
      
      setTimeRemaining(remaining);
    }

    // Initial update
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  // Don't render until we have the time calculated (prevents hydration mismatch)
  if (timeRemaining === null) {
    return null;
  }

  const isUrgent = timeRemaining > 0 && timeRemaining < 60 * 60 * 1000; // Less than 1 hour

  // "Dropping now" state - cron is executing
  if (state === 'dropping') {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 px-4 py-2.5 dark:from-violet-500/20 dark:to-fuchsia-500/20">
        <Loader2 className="h-4 w-4 text-violet-500 animate-spin" />
        <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
          AI question dropping now!
        </span>
        <Bot className="h-4 w-4 text-fuchsia-500 animate-bounce" />
      </div>
    );
  }

  // "Just dropped" state - question is posted
  if (state === 'dropped') {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 px-4 py-2.5 dark:from-violet-500/20 dark:to-fuchsia-500/20">
        <Sparkles className="h-4 w-4 text-violet-500 animate-pulse" />
        <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
          New AI question just dropped!
        </span>
        <Sparkles className="h-4 w-4 text-fuchsia-500 animate-pulse" />
      </div>
    );
  }

  // Countdown state
  return (
    <div className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 transition-all ${
      isUrgent 
        ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20' 
        : 'bg-zinc-100 dark:bg-zinc-800/50'
    }`}>
      <Bot className={`h-4 w-4 ${
        isUrgent 
          ? 'text-amber-600 dark:text-amber-400 animate-pulse' 
          : 'text-zinc-500 dark:text-zinc-400'
      }`} />
      <span className={`text-sm ${
        isUrgent 
          ? 'font-medium text-amber-700 dark:text-amber-300' 
          : 'text-zinc-600 dark:text-zinc-400'
      }`}>
        Next AI question in{' '}
        <span className={`font-semibold tabular-nums ${
          isUrgent 
            ? 'text-amber-800 dark:text-amber-200' 
            : 'text-zinc-700 dark:text-zinc-300'
        }`}>
          {formatTimeRemaining(timeRemaining)}
        </span>
      </span>
    </div>
  );
}
