'use client';

import { useRef, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Category } from '@/lib/types';
import { cn } from '@/lib/utils';

const CATEGORIES: { value: Category; emoji: string }[] = [
  { value: 'Effective Altruism', emoji: '🌐' },
  { value: 'Entertainment', emoji: '🎬' },
  { value: 'Environment', emoji: '🌍' },
  { value: 'Ethics', emoji: '⚖️' },
  { value: 'Food & Lifestyle', emoji: '🍕' },
  { value: 'Fun & Silly', emoji: '🎉' },
  { value: 'Health & Wellness', emoji: '🧘' },
  { value: 'Hypothetical', emoji: '🤔' },
  { value: 'Politics', emoji: '🗳️' },
  { value: 'Relationships', emoji: '💕' },
  { value: 'Society', emoji: '🏛️' },
  { value: 'Sports', emoji: '⚽' },
  { value: 'Technology', emoji: '🤖' },
  { value: 'Work & Career', emoji: '💼' },
  { value: 'Other', emoji: '💭' },
];

interface CategoryPillsProps {
  selected: Category | null;
  onChange: (category: Category | null) => void;
}

export function CategoryPills({ selected, onChange }: CategoryPillsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const hasScrolledToInitial = useRef(false);

  // Check scroll position to show/hide arrows
  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    
    setShowLeftArrow(el.scrollLeft > 0);
    setShowRightArrow(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateArrows();
    el.addEventListener('scroll', updateArrows);
    window.addEventListener('resize', updateArrows);

    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, []);

  // Auto-scroll to selected category when it first loads (from saved preferences)
  useEffect(() => {
    if (selected && scrollRef.current && !hasScrolledToInitial.current) {
      hasScrolledToInitial.current = true;
      const selectedButton = scrollRef.current.querySelector(
        `[data-category="${selected}"]`
      ) as HTMLElement | null;
      if (selectedButton) {
        selectedButton.scrollIntoView({ 
          behavior: 'instant', 
          inline: 'center', 
          block: 'nearest' 
        });
        // Update arrows after scroll
        setTimeout(updateArrows, 0);
      }
    }
  }, [selected]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    
    const scrollAmount = 200;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleClick = (category: Category | null) => {
    // If clicking the same category, deselect (go back to All)
    if (category === selected) {
      onChange(null);
    } else {
      onChange(category);
    }
  };

  return (
    <div className="relative -mx-4 px-4">
      {/* Left fade/arrow */}
      {showLeftArrow && (
        <div className="absolute left-0 top-0 z-10 flex h-full items-center bg-gradient-to-r from-white via-white to-transparent pl-2 pr-4 dark:from-zinc-950 dark:via-zinc-950">
          <button
            onClick={() => scroll('left')}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 shadow-sm transition-all hover:bg-zinc-200 active:scale-90 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Scrollable pills container */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* All pill */}
        <button
          onClick={() => handleClick(null)}
          className={cn(
            'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all active:scale-[0.97]',
            selected === null
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
          )}
        >
          All
        </button>

        {/* Category pills */}
        {CATEGORIES.map(({ value, emoji }) => (
          <button
            key={value}
            data-category={value}
            onClick={() => handleClick(value)}
            className={cn(
              'shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all active:scale-[0.97]',
              selected === value
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
            )}
          >
            {emoji} {value}
          </button>
        ))}
      </div>

      {/* Right fade/arrow */}
      {showRightArrow && (
        <div className="absolute right-0 top-0 z-10 flex h-full items-center bg-gradient-to-l from-white via-white to-transparent pl-4 pr-2 dark:from-zinc-950 dark:via-zinc-950">
          <button
            onClick={() => scroll('right')}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 shadow-sm transition-all hover:bg-zinc-200 active:scale-90 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

