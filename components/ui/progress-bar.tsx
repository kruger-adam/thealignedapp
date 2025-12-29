'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  yes: number;
  no: number;
  unsure: number;
  skip?: number;
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
  skip = 0,
  showLabels = true,
  size = 'md',
}: ProgressBarProps) {
  const total = yes + no + unsure + skip;
  
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
  const unsurePercent = Math.round((unsure / total) * 100);
  const skipPercent = 100 - yesPercent - noPercent - unsurePercent;

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
        {noPercent > 0 && (
          <div
            className="bg-rose-500 transition-all duration-500 ease-out"
            style={{ width: `${noPercent}%` }}
          />
        )}
        {unsurePercent > 0 && (
          <div
            className="bg-amber-500 transition-all duration-500 ease-out"
            style={{ width: `${unsurePercent}%` }}
          />
        )}
        {skipPercent > 0 && (
          <div
            className="bg-zinc-400 transition-all duration-500 ease-out"
            style={{ width: `${skipPercent}%` }}
          />
        )}
      </div>
      {showLabels && (
        <div className="flex w-full text-xs font-medium">
          {yesPercent > 0 && (
            <span 
              className="text-center text-emerald-600 dark:text-emerald-400"
              style={{ width: `${yesPercent}%` }}
            >
              {yesPercent}% Yes
            </span>
          )}
          {noPercent > 0 && (
            <span 
              className="text-center text-rose-600 dark:text-rose-400"
              style={{ width: `${noPercent}%` }}
            >
              {noPercent}% No
            </span>
          )}
          {unsurePercent > 0 && (
            <span 
              className="text-center text-amber-600 dark:text-amber-400"
              style={{ width: `${unsurePercent}%` }}
            >
              {unsurePercent}% Not Sure
            </span>
          )}
          {skipPercent > 0 && (
            <span 
              className="text-center text-zinc-500 dark:text-zinc-400"
              style={{ width: `${skipPercent}%` }}
            >
              {skipPercent}% Skip
            </span>
          )}
        </div>
      )}
    </div>
  );
}


