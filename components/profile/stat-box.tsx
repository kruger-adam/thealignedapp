'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Detect touch device
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // Calculate tooltip position when showing
  useEffect(() => {
    if (showTooltip && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const tooltipWidth = 140; // max-w-[140px]
      
      let left: number;
      switch (position) {
        case 'left':
          left = rect.left;
          break;
        case 'right':
          left = rect.right - tooltipWidth;
          break;
        default:
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
      }
      
      // Ensure tooltip doesn't go off screen
      const padding = 8;
      left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));
      
      setTooltipPosition({
        top: rect.bottom + 8, // 8px below the element
        left,
      });
    }
  }, [showTooltip, position]);

  // Close tooltip when clicking/touching outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node)
      ) {
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

  // Calculate arrow position based on container position relative to tooltip
  const getArrowLeft = () => {
    if (!containerRef.current) return '50%';
    const rect = containerRef.current.getBoundingClientRect();
    const containerCenter = rect.left + rect.width / 2;
    return `${containerCenter - tooltipPosition.left}px`;
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
      
      {/* Tooltip rendered via portal to escape overflow:hidden containers */}
      {showTooltip && typeof window !== 'undefined' && createPortal(
        <div 
          ref={tooltipRef}
          className="fixed z-[9999] w-max max-w-[140px] px-2.5 py-1.5 bg-zinc-900 dark:bg-zinc-100 rounded-md shadow-lg pointer-events-none"
          style={{ 
            top: tooltipPosition.top,
            left: tooltipPosition.left,
          }}
        >
          <p className="text-xs font-medium text-white dark:text-zinc-900">{label}</p>
          {tooltip && (
            <p className="text-xs text-zinc-300 dark:text-zinc-600 mt-0.5">{tooltip}</p>
          )}
          {/* Arrow */}
          <div 
            className="absolute -top-1 w-2 h-2 bg-zinc-900 dark:bg-zinc-100 rotate-45"
            style={{ left: getArrowLeft(), transform: 'translateX(-50%) rotate(45deg)' }}
          />
        </div>,
        document.body
      )}
    </div>
  );
}

