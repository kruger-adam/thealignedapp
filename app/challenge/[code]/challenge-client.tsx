'use client';

import { useState, useCallback, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { Check, HelpCircle, X, Users, Sparkles, ArrowRight, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';
import { VoteType } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ChallengeClientProps {
  challengeId: string;
  challengeCode: string;
  sharerVote: VoteType;
  sharer: {
    id: string;
    username: string;
    avatarUrl: string | null;
  } | null;
  question: {
    id: string;
    content: string;
    category: string | null;
    expiresAt: string | null;
    isAI: boolean;
    stats: {
      yesCount: number;
      noCount: number;
      unsureCount: number;
      totalVotes: number;
    };
  };
  currentUserId: string | null;
  existingVote: VoteType | null;
  existingChallengeResponse: {
    voter_vote: VoteType;
    agrees: boolean;
  } | null;
}

export function ChallengeClient({
  challengeId,
  challengeCode: _challengeCode,
  sharerVote,
  sharer,
  question,
  currentUserId,
  existingVote,
  existingChallengeResponse,
}: ChallengeClientProps) {
  // _challengeCode available for future re-share functionality
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [isPending, startTransition] = useTransition();

  // Sign in with Google (stays on this page after auth)
  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(window.location.pathname)}`,
      },
    });
  }, [supabase]);
  
  // State
  const [userVote, setUserVote] = useState<VoteType | null>(existingVote);
  const [showReveal, setShowReveal] = useState(!!existingChallengeResponse);
  const [agrees, setAgrees] = useState(existingChallengeResponse?.agrees ?? null);
  const [localStats, setLocalStats] = useState(question.stats);
  const [isAnimating, setIsAnimating] = useState(false);

  // Is this the sharer viewing their own challenge?
  const isOwnChallenge = currentUserId === sharer?.id;

  const handleVote = useCallback(async (vote: VoteType) => {
    if (!user || isPending) return;

    // Trigger animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 400);

    // Optimistic update
    setUserVote(vote);
    
    // Update stats optimistically
    const newStats = { ...localStats };
    if (vote === 'YES') newStats.yesCount++;
    else if (vote === 'NO') newStats.noCount++;
    else newStats.unsureCount++;
    newStats.totalVotes++;
    setLocalStats(newStats);

    startTransition(async () => {
      try {
        // 1. Save the vote
        const { error: voteError } = await supabase
          .from('responses')
          .upsert(
            {
              user_id: user.id,
              question_id: question.id,
              vote,
              is_ai: false,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,question_id,is_ai' }
          );

        if (voteError) {
          console.error('Error saving vote:', voteError);
          setUserVote(null);
          return;
        }

        // 2. Determine if they agree with the sharer
        const votesAgree = vote === sharerVote;
        setAgrees(votesAgree);

        // 3. Record the challenge response
        await supabase
          .from('challenge_responses')
          .upsert(
            {
              challenge_id: challengeId,
              voter_id: user.id,
              voter_vote: vote,
              agrees: votesAgree,
            },
            { onConflict: 'challenge_id,voter_id' }
          );

        // 4. Create notification for the sharer
        if (sharer && sharer.id !== user.id) {
          await supabase.from('notifications').insert({
            user_id: sharer.id,
            type: 'challenge_vote',
            actor_id: user.id,
            question_id: question.id,
          });
        }

        // 5. Show the reveal with a slight delay for drama
        setTimeout(() => {
          setShowReveal(true);
        }, 300);
      } catch (error) {
        console.error('Error processing vote:', error);
        setUserVote(null);
      }
    });
  }, [user, isPending, supabase, question.id, challengeId, sharer, sharerVote, localStats]);

  const voteLabel = (vote: VoteType) => 
    vote === 'YES' ? 'Yes' : vote === 'NO' ? 'No' : 'Not Sure';

  const voteColor = (vote: VoteType) =>
    vote === 'YES' 
      ? 'text-emerald-600 dark:text-emerald-400' 
      : vote === 'NO' 
      ? 'text-rose-600 dark:text-rose-400' 
      : 'text-amber-600 dark:text-amber-400';

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-lg px-4 py-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-100 to-indigo-100 px-4 py-2 dark:from-violet-900/30 dark:to-indigo-900/30">
            <Users className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
              {isOwnChallenge ? 'Your Challenge' : 'You\'ve Been Challenged'}
            </span>
          </div>
        </div>

        {/* Sharer info */}
        {sharer && !isOwnChallenge && (
          <div className="mb-6 flex items-center justify-center gap-3">
            <Avatar
              src={sharer.avatarUrl}
              fallback={sharer.username}
              size="md"
            />
            <div className="text-center">
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {sharer.username}
              </p>
              <p className="text-sm text-zinc-500">
                wants to know if you agree
              </p>
            </div>
          </div>
        )}

        {/* Question Card */}
        <Card className="mb-6 overflow-hidden">
          <CardContent className="p-6">
            {/* Question */}
            <p className="text-xl font-medium leading-relaxed text-zinc-900 dark:text-zinc-100 mb-6">
              {question.content}
            </p>

            {/* Category */}
            {question.category && (
              <span className="inline-block mb-4 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {question.category}
              </span>
            )}

            {/* Not logged in - prompt to sign in */}
            {!user && (
              <div className="text-center py-4">
                <p className="text-sm text-zinc-500 mb-4">
                  Sign in to vote and see if you agree
                </p>
                <Button onClick={signInWithGoogle} className="gap-2">
                  Sign In to Vote
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Logged in but haven't voted yet */}
            {user && !userVote && !showReveal && (
              <div className="space-y-4">
                <p className="text-center text-sm text-zinc-500 mb-2">
                  What do you think?
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => handleVote('YES')}
                    disabled={isPending}
                    className={cn(
                      "h-14 flex-col gap-1 border-2 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
                      isAnimating && "animate-vote-pop"
                    )}
                  >
                    <Check className="h-5 w-5 text-emerald-600" />
                    <span className="text-sm font-medium">Yes</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleVote('NO')}
                    disabled={isPending}
                    className={cn(
                      "h-14 flex-col gap-1 border-2 hover:border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30",
                      isAnimating && "animate-vote-pop"
                    )}
                  >
                    <X className="h-5 w-5 text-rose-600" />
                    <span className="text-sm font-medium">No</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleVote('UNSURE')}
                    disabled={isPending}
                    className={cn(
                      "h-14 flex-col gap-1 border-2 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30",
                      isAnimating && "animate-vote-pop"
                    )}
                  >
                    <HelpCircle className="h-5 w-5 text-amber-600" />
                    <span className="text-sm font-medium">Unsure</span>
                  </Button>
                </div>
              </div>
            )}

            {/* THE REVEAL MOMENT */}
            {showReveal && userVote && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Results bar */}
                <div className="mb-6">
                  <ProgressBar
                    yes={localStats.yesCount}
                    no={localStats.noCount}
                    unsure={localStats.unsureCount}
                  />
                  <p className="text-center text-sm text-zinc-500 mt-2">
                    {localStats.totalVotes} vote{localStats.totalVotes !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* The Big Reveal */}
                <div className={cn(
                  "rounded-2xl p-6 text-center",
                  agrees 
                    ? "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30"
                    : "bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-950/30 dark:to-orange-950/30"
                )}>
                  {agrees ? (
                    <>
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/50 mb-4">
                        <PartyPopper className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mb-2">
                        You Agree! 🎉
                      </h2>
                      <p className="text-zinc-600 dark:text-zinc-400">
                        You and <span className="font-semibold">{sharer?.username || 'them'}</span> both voted{' '}
                        <span className={cn("font-semibold", voteColor(userVote))}>
                          {voteLabel(userVote)}
                        </span>
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/50 mb-4">
                        <Sparkles className="h-8 w-8 text-rose-600 dark:text-rose-400" />
                      </div>
                      <h2 className="text-2xl font-bold text-rose-700 dark:text-rose-300 mb-2">
                        You Disagree
                      </h2>
                      <p className="text-zinc-600 dark:text-zinc-400">
                        You voted <span className={cn("font-semibold", voteColor(userVote))}>{voteLabel(userVote)}</span>,{' '}
                        <span className="font-semibold">{sharer?.username || 'they'}</span> voted{' '}
                        <span className={cn("font-semibold", voteColor(sharerVote))}>{voteLabel(sharerVote)}</span>
                      </p>
                    </>
                  )}
                </div>

                {/* CTA to explore more */}
                <div className="mt-6 space-y-3">
                  <Link href={`/question/${question.id}`}>
                    <Button variant="outline" className="w-full">
                      See Full Discussion
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button className="w-full gap-2 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600">
                      Explore More Questions
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  {sharer && (
                    <Link href={`/profile/${sharer.id}`}>
                      <Button variant="ghost" className="w-full">
                        Compare with {sharer.username}
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Own challenge view */}
            {isOwnChallenge && (
              <div className="text-center py-4">
                <p className="text-sm text-zinc-500 mb-4">
                  Share this link with friends to see if they agree with you!
                </p>
                <Link href={`/question/${question.id}`}>
                  <Button variant="outline" className="gap-2">
                    View Question
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Aligned branding */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
            <span className="text-sm">Powered by</span>
            <span className="text-sm font-semibold">Aligned</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

