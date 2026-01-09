'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { voteConfig } from '@/lib/constants';
import { usePagination } from '@/lib/hooks/use-pagination';
import { VoteType } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BaseItem {
  question_id: string;
  content: string;
}

interface CommonGroundItem extends BaseItem {
  shared_vote: VoteType;
  controversy_score?: number;
}

interface DivergenceItem extends BaseItem {
  vote_a: VoteType;
  vote_b: VoteType;
}

interface AskThemAboutItem extends BaseItem {
  their_vote: VoteType;
}

interface ShareYourTakeItem extends BaseItem {
  your_vote: VoteType;
}

// Common Ground Card
interface CommonGroundCardProps {
  items: CommonGroundItem[];
  icon: React.ElementType;
  showControversy?: boolean;
}

export function CommonGroundCard({ items, icon: Icon, showControversy = true }: CommonGroundCardProps) {
  const pagination = usePagination(items);

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-emerald-600">
            <Icon className="h-5 w-5" />
            Common Ground
          </CardTitle>
          {pagination.showPagination && (
            <PaginationControls pagination={pagination} />
          )}
        </div>
        <p className="text-sm text-zinc-500">Questions where you both voted the same way.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {pagination.pageItems.map((item) => {
            const config = voteConfig[item.shared_vote];
            const VoteIcon = config.icon;
            return (
              <Link
                key={item.question_id}
                href={`/question/${item.question_id}`}
                className="flex items-center gap-3 rounded-lg bg-emerald-50 p-3 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40"
              >
                <div className={cn('rounded-full p-1.5', config.bg)}>
                  <VoteIcon className={cn('h-4 w-4', config.color)} />
                </div>
                <p className="flex-1 text-sm">{item.content}</p>
                {showControversy && item.controversy_score !== undefined && (
                  <span className="text-xs text-zinc-500">
                    {Math.round(item.controversy_score)}% split
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Divergence Card
interface DivergenceCardProps {
  items: DivergenceItem[];
  icon: React.ElementType;
  labelA?: string;
  labelB?: string;
}

export function DivergenceCard({ items, icon: Icon, labelA = 'You', labelB = 'They' }: DivergenceCardProps) {
  const pagination = usePagination(items);

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-rose-600">
            <Icon className="h-5 w-5" />
            Where You Differ
          </CardTitle>
          {pagination.showPagination && (
            <PaginationControls pagination={pagination} />
          )}
        </div>
        <p className="text-sm text-zinc-500">Questions where you took opposite stances.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {pagination.pageItems.map((item) => (
            <Link
              key={item.question_id}
              href={`/question/${item.question_id}`}
              className="flex items-center gap-3 rounded-lg bg-rose-50 p-3 transition-colors hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40"
            >
              <div className="flex w-24 flex-shrink-0 flex-col gap-0.5">
                <span className="flex items-center gap-1 text-xs">
                  <span className="w-8 font-medium">{labelA}:</span>
                  <span className={voteConfig[item.vote_a].color}>
                    {voteConfig[item.vote_a].label}
                  </span>
                </span>
                <span className="flex items-center gap-1 text-xs">
                  <span className="w-8 font-medium">{labelB}:</span>
                  <span className={voteConfig[item.vote_b].color}>
                    {voteConfig[item.vote_b].label}
                  </span>
                </span>
              </div>
              <p className="flex-1 text-sm">{item.content}</p>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Ask Them About Card
interface AskThemAboutCardProps {
  items: AskThemAboutItem[];
  icon: React.ElementType;
}

export function AskThemAboutCard({ 
  items, 
  icon: Icon, 
}: AskThemAboutCardProps) {
  const title = 'Ask Them About';
  const description = "Questions where you're undecided but they have an opinion.";
  const pagination = usePagination(items);

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-blue-600">
            <Icon className="h-5 w-5" />
            {title}
          </CardTitle>
          {pagination.showPagination && (
            <PaginationControls pagination={pagination} />
          )}
        </div>
        <p className="text-sm text-zinc-500">{description}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {pagination.pageItems.map((item) => {
            const config = voteConfig[item.their_vote];
            const VoteIcon = config.icon;
            return (
              <Link
                key={item.question_id}
                href={`/question/${item.question_id}`}
                className="flex items-center gap-3 rounded-lg bg-blue-50 p-3 transition-colors hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-900/40"
              >
                <div className={cn('rounded-full p-1.5', config.bg)}>
                  <VoteIcon className={cn('h-4 w-4', config.color)} />
                </div>
                <p className="flex-1 text-sm">{item.content}</p>
                <span className="text-xs text-zinc-500">
                  They said {config.label}
                </span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// You Know, They Don't Card
interface ShareYourTakeCardProps {
  items: ShareYourTakeItem[];
  icon: React.ElementType;
}

export function ShareYourTakeCard({ 
  items, 
  icon: Icon,
}: ShareYourTakeCardProps) {
  const title = "You Know, They Don't";
  const description = "Questions where you have an opinion but they're undecided.";
  const pagination = usePagination(items);

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-violet-600">
            <Icon className="h-5 w-5" />
            {title}
          </CardTitle>
          {pagination.showPagination && (
            <PaginationControls pagination={pagination} />
          )}
        </div>
        <p className="text-sm text-zinc-500">{description}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {pagination.pageItems.map((item) => {
            const config = voteConfig[item.your_vote];
            const VoteIcon = config.icon;
            return (
              <Link
                key={item.question_id}
                href={`/question/${item.question_id}`}
                className="flex items-center gap-3 rounded-lg bg-violet-50 p-3 transition-colors hover:bg-violet-100 dark:bg-violet-950/30 dark:hover:bg-violet-900/40"
              >
                <div className={cn('rounded-full p-1.5', config.bg)}>
                  <VoteIcon className={cn('h-4 w-4', config.color)} />
                </div>
                <p className="flex-1 text-sm">{item.content}</p>
                <span className="text-xs text-zinc-500">
                  You said {config.label}
                </span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Pagination Controls (internal helper)
interface PaginationControlsProps {
  pagination: ReturnType<typeof usePagination>;
}

function PaginationControls({ pagination }: PaginationControlsProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500">
      <span>{pagination.startIdx + 1}-{pagination.endIdx} of {pagination.totalItems}</span>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={pagination.prevPage}
          disabled={!pagination.hasPrev}
          className="h-7 w-7 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={pagination.nextPage}
          disabled={!pagination.hasMore}
          className="h-7 w-7 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

