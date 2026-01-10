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
  UserPlus,
  Copy,
  Check,
  Share2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';

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
  const { user } = useAuth();
  const [rankings, setRankings] = useState<RankingUser[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sortAscending, setSortAscending] = useState(false); // false = highest first
  
  // Invite state
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const isOwnProfile = user?.id === profileUserId;

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

  // Generate invite link
  const generateInvite = async () => {
    setInviteLoading(true);
    try {
      const response = await fetch('/api/invite');
      const data = await response.json();
      if (response.ok && data.inviteCode) {
        setInviteCode(data.inviteCode);
      }
    } catch (error) {
      console.error('Error generating invite:', error);
    }
    setInviteLoading(false);
  };

  const inviteUrl = inviteCode ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${inviteCode}` : '';

  const copyInviteLink = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareInvite = async () => {
    if (!inviteUrl) return;
    
    const shareData = {
      title: 'See how aligned we are!',
      text: 'Vote on questions and discover how our views compare on Aligned.',
      url: inviteUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled or share failed, fall back to copy
        copyInviteLink();
      }
    } else {
      copyInviteLink();
    }
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
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-zinc-500">
            No shared votes with other users yet. Vote on more questions to see alignment rankings!
          </p>
          
          {/* Invite CTA for own profile */}
          {isOwnProfile && (
            <div className="rounded-lg border border-dashed border-indigo-300 bg-gradient-to-br from-indigo-50 to-violet-50 p-4 dark:border-indigo-700 dark:from-indigo-950/30 dark:to-violet-950/30">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50">
                  <UserPlus className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    Invite a friend to compare
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    See how aligned you are across all the questions you both vote on.
                  </p>
                  
                  {!inviteCode ? (
                    <Button
                      onClick={generateInvite}
                      disabled={inviteLoading}
                      size="sm"
                      className="mt-3 gap-2"
                    >
                      {inviteLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4" />
                      )}
                      Get Invite Link
                    </Button>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2 rounded-md bg-white p-2 dark:bg-zinc-800">
                        <span className="min-w-0 flex-1 truncate text-sm text-zinc-600 dark:text-zinc-400">
                          {inviteUrl}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={copyInviteLink}
                          className="h-8 w-8 shrink-0 p-0"
                        >
                          {copied ? (
                            <Check className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={shareInvite}
                          className="h-8 w-8 shrink-0 p-0"
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
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
          Who {isOwnProfile ? 'you align' : (profileUsername ? `${profileUsername} aligns` : 'aligns')} with {sortAscending ? 'least' : 'most'}
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
                  {user.agreements} agree · {user.disagreements} disagree
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

        {/* Invite CTA for own profile */}
        {isOwnProfile && (
          <div className="mt-4 rounded-lg border border-dashed border-indigo-300 bg-gradient-to-br from-indigo-50 to-violet-50 p-4 dark:border-indigo-700 dark:from-indigo-950/30 dark:to-violet-950/30">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50">
                <UserPlus className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  Invite a friend to compare
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  See how aligned you are across all the questions you both vote on.
                </p>
                
                {!inviteCode ? (
                  <Button
                    onClick={generateInvite}
                    disabled={inviteLoading}
                    size="sm"
                    className="mt-3 gap-2"
                  >
                    {inviteLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    Get Invite Link
                  </Button>
                ) : (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 rounded-md bg-white p-2 dark:bg-zinc-800">
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-600 dark:text-zinc-400">
                        {inviteUrl}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyInviteLink}
                        className="h-8 w-8 shrink-0 p-0"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={shareInvite}
                        className="h-8 w-8 shrink-0 p-0"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

