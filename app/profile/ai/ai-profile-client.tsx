'use client';

import { useState } from 'react';
import {
  Check,
  X as XIcon,
  HelpCircle,
  Bot,
  Heart,
  Swords,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { VoteType } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AIResponse {
  id: string;
  vote: VoteType;
  ai_reasoning: string | null;
  created_at: string;
  question: {
    id: string;
    content: string;
    created_at: string;
  } | null;
}

interface AIProfileClientProps {
  responses: AIResponse[];
  stats: {
    totalVotes: number;
    yesCount: number;
    noCount: number;
    unsureCount: number;
  };
  compatibility: {
    compatibility_score: number;
    common_questions: number;
    agreements: number;
    disagreements: number;
  } | null;
  commonGround: Array<{
    question_id: string;
    content: string;
    shared_vote: VoteType;
    ai_reasoning: string | null;
  }>;
  divergence: Array<{
    question_id: string;
    content: string;
    vote_user: VoteType;
    vote_ai: VoteType;
    ai_reasoning: string | null;
  }>;
  isLoggedIn: boolean;
}

type StanceFilter = 'all' | 'YES' | 'NO' | 'UNSURE';

const voteConfig = {
  YES: { icon: Check, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Yes' },
  NO: { icon: XIcon, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/30', label: 'No' },
  UNSURE: { icon: HelpCircle, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30', label: 'Not Sure' },
};

export function AIProfileClient({
  responses,
  stats,
  compatibility,
  commonGround,
  divergence,
  isLoggedIn,
}: AIProfileClientProps) {
  const [stanceFilter, setStanceFilter] = useState<StanceFilter>('all');
  const [showAllStances, setShowAllStances] = useState(false);
  const [commonGroundPage, setCommonGroundPage] = useState(0);
  const [divergencePage, setDivergencePage] = useState(0);

  const PAGE_SIZE = 5;

  const filteredResponses = stanceFilter === 'all' 
    ? responses 
    : responses.filter(r => r.vote === stanceFilter);

  const displayedResponses = showAllStances 
    ? filteredResponses 
    : filteredResponses.slice(0, 10);

  const yesPercent = stats.totalVotes > 0 ? Math.round((stats.yesCount / stats.totalVotes) * 100) : 0;
  const noPercent = stats.totalVotes > 0 ? Math.round((stats.noCount / stats.totalVotes) * 100) : 0;
  const unsurePercent = stats.totalVotes > 0 ? Math.round((stats.unsureCount / stats.totalVotes) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 slide-in-from-bottom-2">
      {/* AI Profile Header */}
      <Card className="mb-6 overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600" />
        <CardContent className="relative pb-6 pt-0">
          <div className="-mt-12 mb-3">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg dark:border-zinc-900">
              <Bot className="h-10 w-10 text-white" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              AI
            </h1>
            <p className="text-sm text-zinc-500">
              Powered by GPT-4.1-mini • Votes on every question
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col items-center p-4">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {stats.totalVotes}
            </span>
            <span className="text-xs text-zinc-500">Total Votes</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-4">
            <span className="text-2xl font-bold text-emerald-600">{stats.yesCount}</span>
            <span className="text-xs text-zinc-500">Yes</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-4">
            <span className="text-2xl font-bold text-rose-600">{stats.noCount}</span>
            <span className="text-xs text-zinc-500">No</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-4">
            <span className="text-2xl font-bold text-amber-600">{stats.unsureCount}</span>
            <span className="text-xs text-zinc-500">Not Sure</span>
          </CardContent>
        </Card>
      </div>

      {/* Vote Distribution */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Vote Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgressBar yes={yesPercent} no={noPercent} unsure={unsurePercent} />
        </CardContent>
      </Card>

      {/* Compatibility Section (only if logged in) */}
      {isLoggedIn && compatibility && (
        <Card className="mb-6 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
                <TrendingUp className="h-7 w-7 text-violet-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-medium text-zinc-600 dark:text-zinc-400">
                    Agreement Rate
                  </span>
                </div>
                <div className="text-3xl font-bold text-violet-600">
                  {compatibility.compatibility_score}%
                </div>
              </div>
              <div className="text-right text-sm text-zinc-500">
                <div>{compatibility.agreements} agreements</div>
                <div>{compatibility.disagreements} disagreements</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Common Ground */}
      {isLoggedIn && commonGround.length > 0 && (() => {
        const startIdx = commonGroundPage * PAGE_SIZE;
        const endIdx = Math.min(startIdx + PAGE_SIZE, commonGround.length);
        const pageItems = commonGround.slice(startIdx, endIdx);
        const totalPages = Math.ceil(commonGround.length / PAGE_SIZE);
        
        return (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-emerald-600">
                  <Heart className="h-5 w-5" />
                  Where You Agree
                </CardTitle>
                {commonGround.length > PAGE_SIZE && (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>{startIdx + 1}-{endIdx} of {commonGround.length}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCommonGroundPage(p => p - 1)}
                        disabled={commonGroundPage === 0}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCommonGroundPage(p => p + 1)}
                        disabled={commonGroundPage >= totalPages - 1}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {pageItems.map((item) => {
                const config = voteConfig[item.shared_vote as keyof typeof voteConfig];
                const Icon = config?.icon || HelpCircle;
                return (
                  <Link
                    key={item.question_id}
                    href={`/question/${item.question_id}`}
                    className={cn(
                      'block rounded-lg p-3 transition-colors',
                      config?.bg || 'bg-zinc-100 dark:bg-zinc-800',
                      'hover:opacity-80'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('mt-0.5 rounded-full p-1', config?.bg)}>
                        <Icon className={cn('h-4 w-4', config?.color)} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {item.content}
                        </p>
                        {item.ai_reasoning && (
                          <p className="mt-1 text-xs text-zinc-500 italic">
                            AI: &ldquo;{item.ai_reasoning}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        );
      })()}

      {/* Divergence */}
      {isLoggedIn && divergence.length > 0 && (() => {
        const startIdx = divergencePage * PAGE_SIZE;
        const endIdx = Math.min(startIdx + PAGE_SIZE, divergence.length);
        const pageItems = divergence.slice(startIdx, endIdx);
        const totalPages = Math.ceil(divergence.length / PAGE_SIZE);
        
        return (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-rose-600">
                  <Swords className="h-5 w-5" />
                  Where You Differ
                </CardTitle>
                {divergence.length > PAGE_SIZE && (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>{startIdx + 1}-{endIdx} of {divergence.length}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDivergencePage(p => p - 1)}
                        disabled={divergencePage === 0}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDivergencePage(p => p + 1)}
                        disabled={divergencePage >= totalPages - 1}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {pageItems.map((item) => {
                const userConfig = voteConfig[item.vote_user as keyof typeof voteConfig];
                const aiConfig = voteConfig[item.vote_ai as keyof typeof voteConfig];
                return (
                  <Link
                    key={item.question_id}
                    href={`/question/${item.question_id}`}
                    className="block rounded-lg bg-rose-50 p-3 transition-colors hover:opacity-80 dark:bg-rose-950/20"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col gap-1 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-zinc-500">You:</span>
                          <span className={userConfig?.color}>{userConfig?.label}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-zinc-500">AI:</span>
                          <span className={aiConfig?.color}>{aiConfig?.label}</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {item.content}
                        </p>
                        {item.ai_reasoning && (
                          <p className="mt-1 text-xs text-zinc-500 italic">
                            AI: &ldquo;{item.ai_reasoning}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        );
      })()}

      {/* Not logged in message */}
      {!isLoggedIn && (
        <Card className="mb-6 bg-zinc-50 dark:bg-zinc-800/50">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-zinc-500">
              <Link href="/login" className="text-violet-600 hover:underline">Sign in</Link> to see how your views compare with the AI
            </p>
          </CardContent>
        </Card>
      )}

      {/* AI's Voting History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Voting History</CardTitle>
            <div className="flex gap-1">
              {(['all', 'YES', 'NO', 'UNSURE'] as const).map((filter) => (
                <Button
                  key={filter}
                  variant={stanceFilter === filter ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setStanceFilter(filter)}
                  className="h-7 px-2 text-xs"
                >
                  {filter === 'all' ? 'All' : voteConfig[filter]?.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {displayedResponses.length === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-500">No votes to display</p>
          ) : (
            <>
              {displayedResponses.map((response) => {
                if (!response.question) return null;
                const config = voteConfig[response.vote as keyof typeof voteConfig];
                const Icon = config?.icon || HelpCircle;
                
                return (
                  <Link
                    key={response.id}
                    href={`/question/${response.question.id}`}
                    className={cn(
                      'block rounded-lg border p-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
                      'border-zinc-100 dark:border-zinc-800'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('rounded-full p-1.5', config?.bg)}>
                        <Icon className={cn('h-4 w-4', config?.color)} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {response.question.content}
                        </p>
                        {response.ai_reasoning && (
                          <p className="mt-1 text-xs text-zinc-500 italic">
                            &ldquo;{response.ai_reasoning}&rdquo;
                          </p>
                        )}
                        <p className="mt-1 text-xs text-zinc-400">
                          {new Date(response.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
              
              {filteredResponses.length > 10 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllStances(!showAllStances)}
                  className="w-full"
                >
                  {showAllStances ? (
                    <>
                      <ChevronUp className="mr-1 h-4 w-4" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-1 h-4 w-4" />
                      Show All ({filteredResponses.length})
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

