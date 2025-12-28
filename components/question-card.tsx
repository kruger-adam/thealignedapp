'use client';

import { useState, useTransition, useMemo } from 'react';
import { Check, HelpCircle, X, MessageCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
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

interface Voter {
  id: string;
  username: string | null;
  avatar_url: string | null;
  vote: VoteType;
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
  const [showVoters, setShowVoters] = useState(false);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loadingVoters, setLoadingVoters] = useState(false);

  const fetchVoters = async () => {
    if (voters.length > 0) {
      // Already fetched, just toggle
      setShowVoters(!showVoters);
      return;
    }
    
    setLoadingVoters(true);
    try {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/responses?select=vote,user_id&question_id=eq.${question.id}`;
      const res = await fetch(url, {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      });
      const responses = await res.json();
      
      if (responses.length > 0) {
        const userIds = responses.map((r: { user_id: string }) => r.user_id);
        const profilesUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=id,username,avatar_url&id=in.(${userIds.join(',')})`;
        const profilesRes = await fetch(profilesUrl, {
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
          },
        });
        const profiles = await profilesRes.json();
        
        const profileMap = Object.fromEntries(
          profiles.map((p: { id: string; username: string | null; avatar_url: string | null }) => [p.id, p])
        );
        
        const votersList: Voter[] = responses.map((r: { user_id: string; vote: string }) => ({
          id: r.user_id,
          username: profileMap[r.user_id]?.username || 'Anonymous',
          avatar_url: profileMap[r.user_id]?.avatar_url || null,
          vote: r.vote as VoteType,
        }));
        
        setVoters(votersList);
      }
      setShowVoters(true);
    } catch (err) {
      console.error('Error fetching voters:', err);
    }
    setLoadingVoters(false);
  };
  
  // Local state for vote (persists after voting without refetch)
  const [localUserVote, setLocalUserVote] = useState<VoteType | null>(question.user_vote ?? null);
  const [localStats, setLocalStats] = useState(question.stats);

  const updateVoteState = (newVote: VoteType) => {
    const oldVote = localUserVote;
    const newStats = { ...localStats };

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

    setLocalUserVote(newVote);
    setLocalStats(newStats);
  };

  // Create optimisticData object for compatibility with existing code
  const optimisticData = {
    userVote: localUserVote,
    stats: localStats,
  };

  const handleVote = async (vote: VoteType) => {
    if (!user) return;

    // Update local state immediately
    updateVoteState(vote);

    startTransition(async () => {

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
          <button
            onClick={fetchVoters}
            disabled={optimisticData.stats.total_votes === 0}
            className={cn(
              "flex items-center gap-1.5 text-xs text-zinc-500 transition-colors",
              optimisticData.stats.total_votes > 0 && "hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer"
            )}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span>{optimisticData.stats.total_votes} votes</span>
            {optimisticData.stats.total_votes > 0 && (
              loadingVoters ? (
                <span className="h-3 w-3 animate-spin rounded-full border border-zinc-400 border-t-transparent" />
              ) : showVoters ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )
            )}
          </button>
        </div>
      </CardHeader>

      {/* Expandable Voters List */}
      {showVoters && voters.length > 0 && (
        <div className="border-t border-zinc-100 px-6 py-3 dark:border-zinc-800">
          <div className="space-y-3">
            {/* Yes voters */}
            {voters.filter(v => v.vote === 'YES').length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-emerald-600">Yes</p>
                <div className="flex flex-wrap gap-2">
                  {voters.filter(v => v.vote === 'YES').map(voter => (
                    <Link key={voter.id} href={`/profile/${voter.id}`}>
                      <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 py-1 pl-1 pr-2.5 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40">
                        <Avatar src={voter.avatar_url} fallback={voter.username || ''} size="sm" className="h-5 w-5" />
                        <span className="text-xs text-emerald-700 dark:text-emerald-300">{voter.username}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {/* No voters */}
            {voters.filter(v => v.vote === 'NO').length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-rose-600">No</p>
                <div className="flex flex-wrap gap-2">
                  {voters.filter(v => v.vote === 'NO').map(voter => (
                    <Link key={voter.id} href={`/profile/${voter.id}`}>
                      <div className="flex items-center gap-1.5 rounded-full bg-rose-50 py-1 pl-1 pr-2.5 transition-colors hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40">
                        <Avatar src={voter.avatar_url} fallback={voter.username || ''} size="sm" className="h-5 w-5" />
                        <span className="text-xs text-rose-700 dark:text-rose-300">{voter.username}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {/* Not Sure voters */}
            {voters.filter(v => v.vote === 'UNSURE').length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-amber-600">Not Sure</p>
                <div className="flex flex-wrap gap-2">
                  {voters.filter(v => v.vote === 'UNSURE').map(voter => (
                    <Link key={voter.id} href={`/profile/${voter.id}`}>
                      <div className="flex items-center gap-1.5 rounded-full bg-amber-50 py-1 pl-1 pr-2.5 transition-colors hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40">
                        <Avatar src={voter.avatar_url} fallback={voter.username || ''} size="sm" className="h-5 w-5" />
                        <span className="text-xs text-amber-700 dark:text-amber-300">{voter.username}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
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
            Not Sure
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


