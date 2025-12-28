'use client';

import { useState, useOptimistic, useTransition, useMemo } from 'react';
import { Check, HelpCircle, X, MessageCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';
import { QuestionWithStats, VoteType } from '@/lib/types';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface QuestionCardProps {
  question: QuestionWithStats;
  authorName?: string;
  authorAvatar?: string | null;
  onVote?: (questionId: string, vote: VoteType) => void;
}

export function QuestionCard({
  question,
  authorName,
  authorAvatar,
  onVote,
}: QuestionCardProps) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [isPending, startTransition] = useTransition();
  
  // Optimistic UI state
  const [optimisticData, setOptimisticData] = useOptimistic(
    {
      userVote: question.user_vote,
      stats: question.stats,
    },
    (state, newVote: VoteType | null) => {
      const oldVote = state.userVote;
      const newStats = { ...state.stats };

      // Remove old vote count
      if (oldVote) {
        if (oldVote === 'YES') newStats.yes_count--;
        else if (oldVote === 'NO') newStats.no_count--;
        else newStats.unsure_count--;
        newStats.total_votes--;
      }

      // Add new vote count
      if (newVote) {
        if (newVote === 'YES') newStats.yes_count++;
        else if (newVote === 'NO') newStats.no_count++;
        else newStats.unsure_count++;
        newStats.total_votes++;
      }

      // Recalculate percentages
      if (newStats.total_votes > 0) {
        newStats.yes_percentage = Math.round((newStats.yes_count / newStats.total_votes) * 100);
        newStats.no_percentage = Math.round((newStats.no_count / newStats.total_votes) * 100);
        newStats.unsure_percentage = 100 - newStats.yes_percentage - newStats.no_percentage;
      } else {
        newStats.yes_percentage = 0;
        newStats.no_percentage = 0;
        newStats.unsure_percentage = 0;
      }

      return {
        userVote: newVote,
        stats: newStats,
      };
    }
  );

  const handleVote = async (vote: VoteType) => {
    if (!user) return;

    startTransition(async () => {
      // Optimistically update
      setOptimisticData(vote);

      // Perform the actual update
      const { error } = await supabase
        .from('responses')
        .upsert(
          {
            user_id: user.id,
            question_id: question.id,
            vote,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,question_id',
          }
        );

      if (error) {
        console.error('Error voting:', error);
        // Revert on error - would need proper error handling in production
      }

      onVote?.(question.id, vote);
    });
  };

  const hasVoted = !!optimisticData.userVote;
  const timeAgo = getTimeAgo(new Date(question.created_at));

  return (
    <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <Link 
            href={`/profile/${question.author_id}`}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <Avatar
              src={authorAvatar}
              fallback={authorName || 'Anonymous'}
              size="sm"
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {authorName || 'Anonymous'}
              </span>
              <span className="flex items-center gap-1 text-xs text-zinc-500">
                <Clock className="h-3 w-3" />
                {timeAgo}
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <MessageCircle className="h-3.5 w-3.5" />
            <span>{optimisticData.stats.total_votes} votes</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pb-4">
        <p className="text-lg font-medium leading-relaxed text-zinc-900 dark:text-zinc-100">
          {question.content}
        </p>
      </CardContent>

      <CardFooter className="flex-col gap-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        {/* Vote Buttons */}
        <div className="grid w-full grid-cols-3 gap-2">
          <Button
            variant={optimisticData.userVote === 'YES' ? 'yes' : 'yes-outline'}
            size="sm"
            onClick={() => handleVote('YES')}
            disabled={isPending || !user}
            className={cn(
              'flex-1 gap-1.5',
              optimisticData.userVote === 'YES' && 'ring-2 ring-emerald-500/50'
            )}
          >
            <Check className="h-4 w-4" />
            Yes
          </Button>
          <Button
            variant={optimisticData.userVote === 'UNSURE' ? 'unsure' : 'unsure-outline'}
            size="sm"
            onClick={() => handleVote('UNSURE')}
            disabled={isPending || !user}
            className={cn(
              'flex-1 gap-1.5',
              optimisticData.userVote === 'UNSURE' && 'ring-2 ring-amber-500/50'
            )}
          >
            <HelpCircle className="h-4 w-4" />
            Unsure
          </Button>
          <Button
            variant={optimisticData.userVote === 'NO' ? 'no' : 'no-outline'}
            size="sm"
            onClick={() => handleVote('NO')}
            disabled={isPending || !user}
            className={cn(
              'flex-1 gap-1.5',
              optimisticData.userVote === 'NO' && 'ring-2 ring-rose-500/50'
            )}
          >
            <X className="h-4 w-4" />
            No
          </Button>
        </div>

        {/* Results - Show after voting or if has votes */}
        {(hasVoted || optimisticData.stats.total_votes > 0) && (
          <div className="w-full animate-in fade-in slide-in-from-top-2 duration-300">
            <ProgressBar
              yes={optimisticData.stats.yes_count}
              no={optimisticData.stats.no_count}
              unsure={optimisticData.stats.unsure_count}
              size="md"
            />
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}


