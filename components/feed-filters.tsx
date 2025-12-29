'use client';

import { Flame, TrendingUp, Clock, Users, Filter } from 'lucide-react';
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
      {/* Category filter - icon-only select */}
      <div className="relative">
        <select
          value={currentCategory || ''}
          onChange={(e) => onCategoryChange(e.target.value as Category || null)}
          className={cn(
            'h-8 w-8 cursor-pointer appearance-none rounded-lg border-0 bg-zinc-100 pl-2 pr-2 text-transparent focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-800/50 dark:focus:ring-zinc-600',
            currentCategory && 'ring-2 ring-zinc-400 dark:ring-zinc-500'
          )}
          title={currentCategory || 'Filter by category'}
        >
          <option value="">All</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <Filter className={cn(
          "pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2",
          currentCategory ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'
        )} />
      </div>

      {/* Sort options - icon only */}
      <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800/50">
        {sortOptions.map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            variant="ghost"
            size="sm"
            onClick={() => onSortChange(value)}
            title={label}
            className={cn(
              'h-7 w-7 p-0',
              currentSort === value
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            )}
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
      </div>
    </div>
  );
}


