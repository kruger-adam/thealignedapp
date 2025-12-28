'use client';

import { Flame, TrendingUp, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SortOption } from '@/lib/types';
import { cn } from '@/lib/utils';

interface FeedFiltersProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
}

const sortOptions: { value: SortOption; label: string; icon: React.ElementType }[] = [
  { value: 'newest', label: 'Newest', icon: Clock },
  { value: 'popular', label: 'Most Votes', icon: Users },
  { value: 'controversial', label: 'Most Split', icon: Flame },
  { value: 'consensus', label: 'Most Agreed', icon: TrendingUp },
];

export function FeedFilters({ currentSort, onSortChange }: FeedFiltersProps) {
  return (
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
  );
}


