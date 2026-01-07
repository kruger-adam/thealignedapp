'use client';

import { useState, useEffect } from 'react';
import { Bot, Sparkles } from 'lucide-react';

// The cron job runs at 12:00 PM Toronto time (America/Toronto)
const CRON_HOUR = 12; // 12:00 PM
const CRON_MINUTE = 0;
const CRON_TIMEZONE = 'America/Toronto';

// How long to show "just dropped" message after posting (in minutes)
const JUST_DROPPED_DURATION = 5;

function getNextCronTime(): Date {
  const now = new Date();
  
  // Get current time in Toronto
  const torontoFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: CRON_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = torontoFormatter.formatToParts(now);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';
  
  const torontoHour = parseInt(getPart('hour'));
  const torontoMinute = parseInt(getPart('minute'));
  
  // Create today's cron time in Toronto
  // We need to construct the date properly
  const torontoYear = parseInt(getPart('year'));
  const torontoMonth = parseInt(getPart('month')) - 1; // 0-indexed
  const torontoDay = parseInt(getPart('day'));
  
  // Create a date string for today at cron time in Toronto
  const cronDateStr = `${torontoYear}-${String(torontoMonth + 1).padStart(2, '0')}-${String(torontoDay).padStart(2, '0')}T${String(CRON_HOUR).padStart(2, '0')}:${String(CRON_MINUTE).padStart(2, '0')}:00`;
  
  // Parse this as Toronto time and convert to UTC
  // Use a trick: create the date and adjust for timezone offset
  const cronTimeToday = new Date(cronDateStr);
  
  // Get the offset between Toronto and UTC at this time
  const torontoOffset = getTimezoneOffset(CRON_TIMEZONE, cronTimeToday);
  const utcCronTime = new Date(cronTimeToday.getTime() + torontoOffset);
  
  // Check if we've passed today's cron time
  const currentTorontoMinutes = torontoHour * 60 + torontoMinute;
  const cronMinutes = CRON_HOUR * 60 + CRON_MINUTE;
  
  if (currentTorontoMinutes >= cronMinutes) {
    // Already passed today, use tomorrow
    utcCronTime.setDate(utcCronTime.getDate() + 1);
  }
  
  return utcCronTime;
}

function getTimezoneOffset(timezone: string, date: Date): number {
  // Get the offset in minutes for a timezone at a specific date
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  return (utcDate.getTime() - tzDate.getTime());
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '0m';
  
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
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
      // This is JUST_DROPPED_DURATION minutes after the cron time
      const msSinceCron = -remaining; // Negative remaining means we're past cron time
      if (msSinceCron >= 0 && msSinceCron < JUST_DROPPED_DURATION * 60 * 1000) {
        setJustDropped(true);
        setTimeRemaining(remaining);
      } else {
        setJustDropped(false);
        setTimeRemaining(remaining);
      }
    }

    // Initial update
    updateCountdown();

    // Update every second when close, every minute otherwise
    const interval = setInterval(() => {
      updateCountdown();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Don't render until we have the time calculated (prevents hydration mismatch)
  if (timeRemaining === null) {
    return null;
  }

  const isUrgent = timeRemaining > 0 && timeRemaining < 60 * 60 * 1000; // Less than 1 hour

  if (justDropped) {
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

