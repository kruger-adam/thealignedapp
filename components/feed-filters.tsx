'use client';

import { Flame, TrendingUp, Clock, Users, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SortOption, Category } from '@/lib/types';
import { cn } from '@/lib/utils';

interface FeedFiltersProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
  currentCategory: Category | null;
  onCategoryChange: (category: Category | null) => void;
}

const sortOptions: { value: SortOption; label: string; icon: React.ElementType }[] = [
  { value: 'newest', label: 'Newest', icon: Clock },
  { value: 'popular', label: 'Most Votes', icon: Users },
  { value: 'controversial', label: 'Most Split', icon: Flame },
  { value: 'consensus', label: 'Most Agreed', icon: TrendingUp },
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
  return (
    <div className="flex items-center gap-2">
      {/* Category filter dropdown */}
      <div className="relative">
        <select
          value={currentCategory || ''}
          onChange={(e) => onCategoryChange(e.target.value as Category || null)}
          className={cn(
            'h-8 appearance-none rounded-lg border-0 bg-zinc-100 pl-7 pr-8 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-800/50 dark:focus:ring-zinc-600',
            currentCategory
              ? 'text-zinc-900 dark:text-zinc-100'
              : 'text-zinc-500 dark:text-zinc-400'
          )}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <Filter className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        {currentCategory && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCategoryChange(null);
            }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            <X className="h-3 w-3 text-zinc-400" />
          </button>
        )}
      </div>

      {/* Sort options */}
      <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800/50">
        {sortOptions.map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            variant="ghost"
            size="sm"
            onClick={() => onSortChange(value)}
            className={cn(
              'flex-1 gap-1.5 text-xs font-medium',
              currentSort === value
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}


