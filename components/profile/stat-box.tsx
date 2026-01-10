'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface StatBoxProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  className?: string;
  tooltip?: string;
  position?: 'left' | 'center' | 'right';
}

export function StatBox({ label, value, icon: Icon, className, tooltip, position = 'center' }: StatBoxProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect touch device
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // Close tooltip when clicking/touching outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowTooltip(false);
      }
    };

    if (showTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [showTooltip]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setShowTooltip(prev => !prev);
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (!isTouchDevice) {
      setShowTooltip(true);
    }
  }, [isTouchDevice]);

  const handleMouseLeave = useCallback(() => {
    if (!isTouchDevice) {
      setShowTooltip(false);
    }
  }, [isTouchDevice]);

  // Position classes for tooltip
  const getTooltipPositionClasses = () => {
    switch (position) {
      case 'left':
        return 'left-0 translate-x-0';
      case 'right':
        return 'right-0 translate-x-0 left-auto';
      default:
        return 'left-1/2 -translate-x-1/2';
    }
  };

  const getArrowPositionClasses = () => {
    switch (position) {
      case 'left':
        return 'left-4';
      case 'right':
        return 'right-4 left-auto';
      default:
        return 'left-1/2 -translate-x-1/2';
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative text-center cursor-pointer select-none"
      onTouchEnd={handleTouchEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={cn('mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800', className)}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      
      {/* Tooltip shows on hover (desktop) or tap (mobile) */}
      {showTooltip && (
        <div className={cn(
          "absolute top-full mt-2 z-50 w-max max-w-[140px] px-2.5 py-1.5 bg-zinc-900 dark:bg-zinc-100 rounded-md shadow-lg",
          getTooltipPositionClasses()
        )}>
          <p className="text-xs font-medium text-white dark:text-zinc-900">{label}</p>
          {tooltip && (
            <p className="text-xs text-zinc-300 dark:text-zinc-600 mt-0.5">{tooltip}</p>
          )}
          {/* Arrow */}
          <div className={cn(
            "absolute -top-1 w-2 h-2 bg-zinc-900 dark:bg-zinc-100 rotate-45",
            getArrowPositionClasses()
          )} />
        </div>
      )}
    </div>
  );
}

