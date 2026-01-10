'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpDown, 
  TrendingUp, 
  TrendingDown,
  Users,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface RankingUser {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  compatibility_score: number;
  common_questions: number;
  agreements: number;
  disagreements: number;
}

interface AgreementRankingsProps {
  profileUserId: string;
  profileUsername: string | null;
}

const PAGE_SIZE = 5;

export function AgreementRankings({ profileUserId, profileUsername }: AgreementRankingsProps) {
  const [rankings, setRankings] = useState<RankingUser[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sortAscending, setSortAscending] = useState(false); // false = highest first

  const fetchRankings = useCallback(async (newOffset: number, ascending: boolean) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/agreement-rankings?userId=${profileUserId}&limit=${PAGE_SIZE}&offset=${newOffset}&sortAscending=${ascending}`
      );
      const data = await response.json();
      
      if (response.ok) {
        setRankings(data.rankings);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Error fetching agreement rankings:', error);
    }
    setLoading(false);
  }, [profileUserId]);

  useEffect(() => {
    fetchRankings(0, sortAscending);
  }, [fetchRankings, sortAscending]);

  const handlePrevPage = () => {
    const newOffset = Math.max(0, offset - PAGE_SIZE);
    setOffset(newOffset);
    fetchRankings(newOffset, sortAscending);
  };

  const handleNextPage = () => {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    fetchRankings(newOffset, sortAscending);
  };

  const toggleSort = () => {
    setSortAscending(!sortAscending);
    setOffset(0);
  };

  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;
  const startIdx = total > 0 ? offset + 1 : 0;
  const endIdx = Math.min(offset + PAGE_SIZE, total);

  // Get the score color based on compatibility
  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 75) return 'bg-emerald-100 dark:bg-emerald-900/40';
    if (score >= 50) return 'bg-amber-100 dark:bg-amber-900/40';
    return 'bg-rose-100 dark:bg-rose-900/40';
  };

  if (loading && rankings.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </CardContent>
      </Card>
    );
  }

  if (total === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
            <Users className="h-5 w-5" />
            Alignment Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-zinc-500">
            No shared votes with other users yet. Vote on more questions to see alignment rankings!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
            {sortAscending ? (
              <TrendingDown className="h-5 w-5 text-rose-500" />
            ) : (
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            )}
            {sortAscending ? 'Lowest Alignment' : 'Highest Alignment'}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSort}
              className="gap-1.5 text-xs"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortAscending ? 'Show Highest' : 'Show Lowest'}
            </Button>
          </div>
        </div>
        <p className="text-sm text-zinc-500">
          Who {profileUsername ? `${profileUsername} aligns` : 'aligns'} with {sortAscending ? 'least' : 'most'}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rankings.map((user, index) => (
            <Link
              key={user.user_id}
              href={`/profile/${user.user_id}`}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:bg-zinc-800"
            >
              {/* Rank number */}
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                {offset + index + 1}
              </div>
              
              {/* Avatar */}
              <Avatar
                src={user.avatar_url}
                fallback={user.username || 'A'}
                size="sm"
              />
              
              {/* User info */}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                  {user.username || 'Anonymous'}
                </p>
                <p className="text-xs text-zinc-500">
                  {user.agreements} agree · {user.disagreements} disagree · {user.common_questions} common
                </p>
              </div>
              
              {/* Score */}
              <div className={cn(
                'flex h-10 w-14 shrink-0 items-center justify-center rounded-lg font-bold',
                getScoreBg(user.compatibility_score),
                getScoreColor(user.compatibility_score)
              )}>
                {Math.round(user.compatibility_score)}%
              </div>
            </Link>
          ))}
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <span className="text-xs text-zinc-500">
              {startIdx}-{endIdx} of {total} users
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevPage}
                disabled={!hasPrev || loading}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextPage}
                disabled={!hasNext || loading}
                className="h-8 w-8 p-0"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

