'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';

interface StatBoxProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  className?: string;
  tooltip?: string;
}

export function StatBox({ label, value, icon: Icon, className, tooltip }: StatBoxProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative text-center">
      <div className={cn('mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800', className)}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      <div className="flex items-center justify-center gap-0.5">
        <p className="text-xs text-zinc-500">{label}</p>
        {tooltip && (
          <button
            type="button"
            onClick={() => setShowTooltip(!showTooltip)}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            aria-label={`Info about ${label}`}
          >
            <Info className="h-3 w-3" />
          </button>
        )}
      </div>
      {tooltip && showTooltip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-10 w-32 px-2 py-1 text-xs text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 rounded-md shadow-lg border border-zinc-200 dark:border-zinc-700">
          {tooltip}
        </div>
      )}
    </div>
  );
}

