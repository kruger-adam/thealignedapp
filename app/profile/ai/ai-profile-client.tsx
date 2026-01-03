'use client';

import { useState } from 'react';
import {
  Check,
  X as XIcon,
  HelpCircle,
  TrendingUp,
  Heart,
  Swords,
  Vote,
  ChevronLeft,
  ChevronRight,
  Bot,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { VoteType } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AIProfile {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

interface ResponseWithQuestion {
  id: string;
  vote: VoteType;
  updated_at: string;
  ai_reasoning: string | null;
  question: {
    id: string;
    content: string;
    created_at: string;
    author_id: string;
  } | null;
}

interface CreatedQuestion {
  id: string;
  content: string;
  created_at: string;
  image_url?: string;
}

interface AIProfileClientProps {
  profile: AIProfile;
  responses: ResponseWithQuestion[];
  stats: {
    totalVotes: number;
    yesCount: number;
    noCount: number;
    unsureCount: number;
    questionsCreated: number;
  };
  compatibility: {
    compatibility_score: number;
    agreements: number;
    disagreements: number;
    total_compared: number;
  } | null;
  commonGround: Array<{
    question_id: string;
    content: string;
    shared_vote: VoteType;
  }>;
  divergence: Array<{
    question_id: string;
    content: string;
    user_vote: VoteType;
    ai_vote: VoteType;
  }>;
  currentUserId?: string;
  createdQuestions: CreatedQuestion[];
}

type Tab = 'stances' | 'questions' | 'comparison';
type StanceFilter = 'all' | 'YES' | 'NO' | 'UNSURE';

const voteConfig = {
  YES: { icon: Check, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Yes' },
  NO: { icon: XIcon, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/30', label: 'No' },
  UNSURE: { icon: HelpCircle, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30', label: 'Not Sure' },
};

export function AIProfileClient({
  profile,
  responses,
  stats,
  compatibility,
  commonGround,
  divergence,
  currentUserId,
  createdQuestions,
}: AIProfileClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>(compatibility ? 'comparison' : 'stances');
  const [stanceFilter, setStanceFilter] = useState<StanceFilter>('all');
  
  // Pagination for comparison lists
  const [commonGroundPage, setCommonGroundPage] = useState(0);
  const [divergencePage, setDivergencePage] = useState(0);
  const PAGE_SIZE = 5;

  const filteredResponses = responses.filter(
    (r) => stanceFilter === 'all' || r.vote === stanceFilter
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 slide-in-from-bottom-2">
      {/* AI Profile Header */}
      <Card className="mb-6 overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600" />
        <CardContent className="relative pb-6 pt-0">
          <div className="-mt-12 mb-3">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg dark:border-zinc-900">
              <Bot className="h-10 w-10 text-white" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {profile.username}
              </h1>
              <Sparkles className="h-5 w-5 text-violet-500" />
            </div>
            <p className="text-sm text-zinc-500">
              I vote on every question and share my reasoning. I also post questions from time to time. Compare your views with mine!
            </p>
          </div>

          {/* Stats Row */}
          <div className="mt-6 grid grid-cols-5 gap-3">
            <StatBox label="Votes" value={stats.totalVotes} icon={Vote} />
            <StatBox label="Yes" value={stats.yesCount} icon={Check} className="text-emerald-600" />
            <StatBox label="No" value={stats.noCount} icon={XIcon} className="text-rose-600" />
            <StatBox label="Not Sure" value={stats.unsureCount} icon={HelpCircle} className="text-amber-600" />
            <StatBox label="Created" value={stats.questionsCreated} icon={MessageSquare} className="text-violet-600" />
          </div>

          {/* Vote Distribution */}
          {stats.totalVotes > 0 && (
            <div className="mt-6">
              <ProgressBar
                yes={stats.yesCount}
                no={stats.noCount}
                unsure={stats.unsureCount}
                showLabels
                size="lg"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compatibility Banner */}
      {compatibility && currentUserId && (
        <Card className="mb-6 overflow-hidden border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50 dark:border-violet-900 dark:from-violet-950/50 dark:to-indigo-950/50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900">
                  <TrendingUp className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-sm text-violet-700 dark:text-violet-300">
                    Agreement Rate
                  </p>
                  <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">
                    {Math.round(compatibility.compatibility_score)}%
                  </p>
                </div>
              </div>
              <div className="text-right text-sm text-violet-600 dark:text-violet-400">
                <p>{compatibility.agreements} {compatibility.agreements === 1 ? 'agreement' : 'agreements'}</p>
                <p>{compatibility.disagreements} {compatibility.disagreements === 1 ? 'disagreement' : 'disagreements'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Not logged in prompt */}
      {!currentUserId && (
        <Card className="mb-6 border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
          <CardContent className="py-4">
            <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
              <Link href="/auth" className="font-medium text-violet-600 hover:underline dark:text-violet-400">
                Sign in
              </Link>
              {' '}to compare your views with the AI
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800/50">
        <TabButton
          active={activeTab === 'stances'}
          onClick={() => setActiveTab('stances')}
          icon={Vote}
          label="AI Votes"
        />
        <TabButton
          active={activeTab === 'questions'}
          onClick={() => setActiveTab('questions')}
          icon={Sparkles}
          label={`Questions (${createdQuestions.length})`}
        />
        {compatibility && (
          <TabButton
            active={activeTab === 'comparison'}
            onClick={() => setActiveTab('comparison')}
            icon={TrendingUp}
            label="Compare"
          />
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'stances' && (
        <div className="space-y-4">
          {/* Filter Buttons */}
          <div className="flex gap-2">
            {(['all', 'YES', 'NO', 'UNSURE'] as const).map((filter) => (
              <Button
                key={filter}
                variant={stanceFilter === filter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStanceFilter(filter)}
                className="flex-1"
              >
                {filter === 'all' ? 'All' : voteConfig[filter].label}
                {filter !== 'all' && (
                  <span className="ml-1 text-xs opacity-75">
                    ({filter === 'YES' ? stats.yesCount : filter === 'NO' ? stats.noCount : stats.unsureCount})
                  </span>
                )}
              </Button>
            ))}
          </div>

          {/* Stances List */}
          {filteredResponses.length === 0 ? (
            <p className="py-8 text-center text-zinc-500">No votes to show.</p>
          ) : (
            <div className="space-y-2">
              {filteredResponses.map((response) => (
                <AIStanceItem key={response.id} response={response} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'questions' && (
        <div className="space-y-3">
          {createdQuestions.length === 0 ? (
            <p className="py-8 text-center text-zinc-500">No questions created yet.</p>
          ) : (
            createdQuestions.map((question) => (
              <Link
                key={question.id}
                href={`/question/${question.id}`}
                className="block"
              >
                <Card className="overflow-hidden transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {question.image_url && (
                        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg">
                          <Image
                            src={question.image_url}
                            alt=""
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm text-zinc-900 dark:text-zinc-100">
                          {question.content}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {new Date(question.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      )}

      {activeTab === 'comparison' && (
        <div className="space-y-6">
          {/* Common Ground */}
          {(() => {
            const startIdx = commonGroundPage * PAGE_SIZE;
            const endIdx = Math.min(startIdx + PAGE_SIZE, commonGround.length);
            const pageItems = commonGround.slice(startIdx, endIdx);
            const totalPages = Math.ceil(commonGround.length / PAGE_SIZE);
            
            return (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-emerald-600">
                      <Heart className="h-5 w-5" />
                      Common Ground
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
                <CardContent>
                  {pageItems.length > 0 ? (
                    <div className="space-y-2">
                      {pageItems.map((item) => (
                        <Link
                          key={item.question_id}
                          href={`/question/${item.question_id}`}
                          className="flex items-center gap-3 rounded-lg bg-emerald-50 p-3 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40"
                        >
                          <div className={cn('rounded-full p-1.5', voteConfig[item.shared_vote].bg)}>
                            {(() => {
                              const Icon = voteConfig[item.shared_vote].icon;
                              return <Icon className={cn('h-4 w-4', voteConfig[item.shared_vote].color)} />;
                            })()}
                          </div>
                          <p className="flex-1 text-sm">{item.content}</p>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">No common ground found yet. Vote on more questions!</p>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* Divergence */}
          {(() => {
            const startIdx = divergencePage * PAGE_SIZE;
            const endIdx = Math.min(startIdx + PAGE_SIZE, divergence.length);
            const pageItems = divergence.slice(startIdx, endIdx);
            const totalPages = Math.ceil(divergence.length / PAGE_SIZE);
            
            return (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-rose-600">
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
                <CardContent>
                  {pageItems.length > 0 ? (
                    <div className="space-y-2">
                      {pageItems.map((item) => (
                        <Link
                          key={item.question_id}
                          href={`/question/${item.question_id}`}
                          className="flex items-center gap-3 rounded-lg bg-rose-50 p-3 transition-colors hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40"
                        >
                          <div className="flex w-24 flex-shrink-0 flex-col gap-0.5">
                            <span className="flex items-center gap-1 text-xs">
                              <span className="w-8 font-medium">You:</span>
                              <span className={voteConfig[item.user_vote].color}>
                                {voteConfig[item.user_vote].label}
                              </span>
                            </span>
                            <span className="flex items-center gap-1 text-xs">
                              <span className="w-8 font-medium">AI:</span>
                              <span className={voteConfig[item.ai_vote].color}>
                                {voteConfig[item.ai_vote].label}
                              </span>
                            </span>
                          </div>
                          <p className="flex-1 text-sm">{item.content}</p>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">No disagreements found! You and the AI think alike.</p>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  className?: string;
}) {
  return (
    <div className="text-center">
      <div className={cn('mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800', className)}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        'flex-1 gap-1.5',
        active
          ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
          : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  );
}

function AIStanceItem({ response }: { response: ResponseWithQuestion }) {
  if (!response.question) return null;

  const config = voteConfig[response.vote];
  const Icon = config.icon;

  return (
    <Link
      href={`/question/${response.question.id}`}
      className="block"
    >
      <div className="rounded-lg border border-zinc-200 bg-white p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/50">
        <div className="flex items-start gap-3">
          <div className={cn('rounded-full p-2', config.bg)}>
            <Icon className={cn('h-4 w-4', config.color)} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-zinc-900 dark:text-zinc-100">
              {response.question.content}
            </p>
            {response.ai_reasoning && (
              <p className="mt-1.5 text-xs text-zinc-500 italic">
                &ldquo;{response.ai_reasoning}&rdquo;
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
