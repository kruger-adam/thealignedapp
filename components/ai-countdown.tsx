'use client';

import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

// The cron job runs at 12:00 PM Toronto time (America/Toronto)
const CRON_HOUR = 12; // 12:00 PM
const CRON_TIMEZONE = 'America/Toronto';

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

interface TimeComponents {
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeComponents(ms: number): TimeComponents {
  if (ms <= 0) return { hours: 0, minutes: 0, seconds: 0 };
  
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return { hours, minutes, seconds };
}

// Flip clock digit component
function FlipDigit({ value, label }: { value: number; label: string }) {
  const display = String(value).padStart(2, '0');
  
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex gap-0.5">
        {display.split('').map((digit, i) => (
          <div
            key={i}
            className="relative h-10 w-7 overflow-hidden rounded-md bg-gradient-to-b from-zinc-800 to-zinc-900 shadow-lg dark:from-zinc-700 dark:to-zinc-800"
          >
            {/* Top half */}
            <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden border-b border-zinc-700/50 bg-gradient-to-b from-zinc-800 to-zinc-850 dark:from-zinc-700 dark:to-zinc-750">
              <span className="absolute inset-0 flex items-end justify-center pb-px text-lg font-bold tabular-nums text-white">
                {digit}
              </span>
            </div>
            {/* Bottom half */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden bg-gradient-to-b from-zinc-850 to-zinc-900 dark:from-zinc-750 dark:to-zinc-800">
              <span className="absolute inset-0 flex items-start justify-center pt-px text-lg font-bold tabular-nums text-zinc-100">
                {digit}
              </span>
            </div>
            {/* Center line shine */}
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-zinc-600/50 to-transparent" />
          </div>
        ))}
      </div>
      <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
    </div>
  );
}

// Separator between digit groups
function Separator({ urgent }: { urgent: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-1 pb-4">
      <div className={`h-1.5 w-1.5 rounded-full ${urgent ? 'bg-amber-500 animate-pulse' : 'bg-zinc-500'}`} />
      <div className={`h-1.5 w-1.5 rounded-full ${urgent ? 'bg-amber-500 animate-pulse' : 'bg-zinc-500'}`} />
    </div>
  );
}

export function AICountdown() {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [justDropped, setJustDropped] = useState(false);

  useEffect(() => {
    function updateCountdown() {
      const now = new Date();
      const nextCron = getNextCronTime();
      const remaining = nextCron.getTime() - now.getTime();
      
      // Check if we're within the "just dropped" window
      // We need to check if we're within JUST_DROPPED_DURATION minutes AFTER the last cron
      const msInDay = 24 * 60 * 60 * 1000;
      const msSinceCron = msInDay - remaining;
      
      if (msSinceCron >= 0 && msSinceCron < JUST_DROPPED_DURATION * 60 * 1000) {
        setJustDropped(true);
      } else {
        setJustDropped(false);
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
  const { hours, minutes, seconds } = getTimeComponents(timeRemaining);

  if (justDropped) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-violet-500/10 px-4 py-3 dark:from-violet-500/20 dark:via-fuchsia-500/20 dark:to-violet-500/20">
        <Sparkles className="h-5 w-5 text-violet-500 animate-pulse" />
        <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">
          New AI question just dropped!
        </span>
        <Sparkles className="h-5 w-5 text-fuchsia-500 animate-pulse" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center rounded-xl px-4 py-3 transition-all ${
      isUrgent 
        ? 'bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 dark:from-amber-500/20 dark:via-orange-500/20 dark:to-amber-500/20' 
        : 'bg-gradient-to-r from-zinc-100 via-zinc-50 to-zinc-100 dark:from-zinc-800/80 dark:via-zinc-800/50 dark:to-zinc-800/80'
    }`}>
      <span className={`mb-2 text-xs font-medium tracking-wide ${
        isUrgent 
          ? 'text-amber-700 dark:text-amber-300' 
          : 'text-zinc-500 dark:text-zinc-400'
      }`}>
        🤖 Next AI question in
      </span>
      
      <div className="flex items-center">
        <FlipDigit value={hours} label="hours" />
        <Separator urgent={isUrgent} />
        <FlipDigit value={minutes} label="mins" />
        <Separator urgent={isUrgent} />
        <FlipDigit value={seconds} label="secs" />
      </div>
    </div>
  );
}
