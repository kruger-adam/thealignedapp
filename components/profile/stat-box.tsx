'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface StatBoxProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  className?: string;
  tooltip?: string;
}

export function StatBox({ label, value, icon: Icon, className, tooltip }: StatBoxProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowTooltip(false);
      }
    };

    if (showTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTooltip]);

  return (
    <div 
      ref={containerRef}
      className="relative text-center cursor-pointer"
      onClick={() => setShowTooltip(!showTooltip)}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={cn('mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800', className)}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      {/* Label visible only on desktop */}
      <p className="hidden sm:block text-xs text-zinc-500">{label}</p>
      
      {/* Tooltip shows on hover (desktop) or tap (mobile) */}
      {showTooltip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-20 w-max max-w-[140px] px-2.5 py-1.5 bg-zinc-900 dark:bg-zinc-100 rounded-md shadow-lg">
          <p className="text-xs font-medium text-white dark:text-zinc-900">{label}</p>
          {tooltip && (
            <p className="text-xs text-zinc-300 dark:text-zinc-600 mt-0.5">{tooltip}</p>
          )}
          {/* Arrow */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 dark:bg-zinc-100 rotate-45" />
        </div>
      )}
    </div>
  );
}

