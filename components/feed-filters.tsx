'use client';

import { ArrowUpDown, Filter } from 'lucide-react';
import { SortOption, Category } from '@/lib/types';
import { cn } from '@/lib/utils';

interface FeedFiltersProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
  currentCategory: Category | null;
  onCategoryChange: (category: Category | null) => void;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most Votes' },
  { value: 'controversial', label: 'Most Split' },
  { value: 'consensus', label: 'Most Agreed' },
  { value: 'most_undecided', label: 'Most Undecided' },
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

export function FeedFilters({ currentSort, onSortChange, currentCategory, onCategoryChange }: FeedFiltersProps) {
  const currentSortLabel = sortOptions.find(s => s.value === currentSort)?.label || 'Sort';
  
  return (
    <div className="flex items-center gap-2">
      {/* Sort dropdown */}
      <div className="relative">
        <select
          value={currentSort}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="h-8 cursor-pointer appearance-none rounded-lg border-0 bg-zinc-100 pl-8 pr-3 text-sm font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-800/50 dark:text-zinc-300 dark:focus:ring-zinc-600"
          title={`Sort by: ${currentSortLabel}`}
        >
          {sortOptions.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      </div>

      {/* Category filter dropdown */}
      <div className="relative">
        <select
          value={currentCategory || ''}
          onChange={(e) => onCategoryChange(e.target.value as Category || null)}
          className={cn(
            'h-8 cursor-pointer appearance-none rounded-lg border-0 bg-zinc-100 pl-8 pr-3 text-sm font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-800/50 dark:text-zinc-300 dark:focus:ring-zinc-600',
            currentCategory && 'ring-2 ring-zinc-400 dark:ring-zinc-500'
          )}
          title={currentCategory || 'Filter by category'}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <Filter className={cn(
          "pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2",
          currentCategory ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-500'
        )} />
      </div>
    </div>
  );
}


