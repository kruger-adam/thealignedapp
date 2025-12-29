'use client';

import { useState, useRef, useEffect } from 'react';
import { ArrowUpDown, Filter, X } from 'lucide-react';
import { SortOption, Category } from '@/lib/types';
import { cn } from '@/lib/utils';

export type MinVotes = 0 | 5 | 10 | 25;

interface FeedFiltersProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
  currentCategory: Category | null;
  onCategoryChange: (category: Category | null) => void;
  minVotes: MinVotes;
  onMinVotesChange: (min: MinVotes) => void;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most Votes' },
  { value: 'controversial', label: 'Most Split' },
  { value: 'consensus', label: 'Most Agreed' },
  { value: 'most_undecided', label: 'Most Undecided' },
  { value: 'most_sensitive', label: 'Most Sensitive' },
];

const minVotesOptions: { value: MinVotes; label: string }[] = [
  { value: 0, label: 'Any' },
  { value: 5, label: '5+' },
  { value: 10, label: '10+' },
  { value: 25, label: '25+' },
];

const categories: Category[] = [
  'Politics & Society',
  'Relationships & Dating',
  'Health & Wellness',
  'Technology',
  'Entertainment & Pop Culture',
  'Food & Lifestyle',
  'Sports',
  'Work & Career',
  'Philosophy & Ethics',
  'Other',
];

export function FeedFilters({ 
  currentSort, 
  onSortChange, 
  currentCategory, 
  onCategoryChange,
  minVotes,
  onMinVotesChange,
}: FeedFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  
  // Count active filters
  const activeFilterCount = (currentCategory ? 1 : 0) + (minVotes > 0 ? 1 : 0);
  
  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilters(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <div className="flex items-center gap-2">
      {/* Sort dropdown - icon only */}
      <div className="relative">
        <select
          value={currentSort}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="h-8 w-8 cursor-pointer appearance-none rounded-lg border-0 bg-zinc-100 text-transparent focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-800/50 dark:focus:ring-zinc-600"
          title={sortOptions.find(s => s.value === currentSort)?.label}
        >
          {sortOptions.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <ArrowUpDown className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      </div>

      {/* Filters button + dropdown */}
      <div className="relative" ref={filterRef}>
        <button
          onClick={() => setShowFilters(!showFilters)}
          title="Filters"
          className={cn(
            'relative flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 transition-colors hover:bg-zinc-200 dark:bg-zinc-800/50 dark:hover:bg-zinc-700/50',
            activeFilterCount > 0 && 'ring-2 ring-zinc-400 dark:ring-zinc-500'
          )}
        >
          <Filter className="h-4 w-4 text-zinc-500" />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-700 text-[10px] text-white dark:bg-zinc-300 dark:text-zinc-900">
              {activeFilterCount}
            </span>
          )}
        </button>
        
        {showFilters && (
          <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Filters</span>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    onCategoryChange(null);
                    onMinVotesChange(0);
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  Clear all
                </button>
              )}
            </div>
            
            {/* Category filter */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Category
              </label>
              <select
                value={currentCategory || ''}
                onChange={(e) => onCategoryChange(e.target.value as Category || null)}
                className="w-full cursor-pointer rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Min votes filter */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Minimum Votes
              </label>
              <div className="flex gap-2">
                {minVotesOptions.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => onMinVotesChange(value)}
                    className={cn(
                      'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                      minVotes === value
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
