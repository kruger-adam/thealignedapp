'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  yes: number;
  no: number;
  unsure: number;
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
};

export function ProgressBar({
  yes,
  no,
  unsure,
  showLabels = true,
  size = 'md',
}: ProgressBarProps) {
  const total = yes + no + unsure;
  
  if (total === 0) {
    return (
      <div className="space-y-2">
        <div
          className={cn(
            'w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700',
            sizeClasses[size]
          )}
        >
          <div className="h-full w-full bg-zinc-300 dark:bg-zinc-600" />
        </div>
        {showLabels && (
          <p className="text-center text-sm text-zinc-500">No votes yet</p>
        )}
      </div>
    );
  }

  const yesPercent = Math.round((yes / total) * 100);
  const noPercent = Math.round((no / total) * 100);
  const unsurePercent = 100 - yesPercent - noPercent;

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'flex w-full overflow-hidden rounded-full',
          sizeClasses[size]
        )}
      >
        {yesPercent > 0 && (
          <div
            className="bg-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${yesPercent}%` }}
          />
        )}
        {unsurePercent > 0 && (
          <div
            className="bg-amber-500 transition-all duration-500 ease-out"
            style={{ width: `${unsurePercent}%` }}
          />
        )}
        {noPercent > 0 && (
          <div
            className="bg-rose-500 transition-all duration-500 ease-out"
            style={{ width: `${noPercent}%` }}
          />
        )}
      </div>
      {showLabels && (
        <div className="flex justify-between text-xs font-medium">
          <span className="text-emerald-600 dark:text-emerald-400">
            {yesPercent}% Yes
          </span>
          <span className="text-amber-600 dark:text-amber-400">
            {unsurePercent}% Unsure
          </span>
          <span className="text-rose-600 dark:text-rose-400">
            {noPercent}% No
          </span>
        </div>
      )}
    </div>
  );
}


