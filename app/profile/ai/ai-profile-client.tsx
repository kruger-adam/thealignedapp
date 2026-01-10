'use client';

import { useState, useMemo } from 'react';
import {
  Check,
  X as XIcon,
  HelpCircle,
  TrendingUp,
  Heart,
  Swords,
  Vote,
  Bot,
  Sparkles,
  MessageSquare,
  Lightbulb,
  MessageSquareShare,
  Loader2,
  Users,
  Handshake,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { 
  StatBox, 
  TabButton, 
  CommonGroundCard, 
  DivergenceCard, 
  AskThemAboutCard, 
  ShareYourTakeCard,
  AgreementRankings,
} from '@/components/profile';
import { VoteType } from '@/lib/types';
import { voteConfig } from '@/lib/constants';
import { cn, getModelDisplayInfo } from '@/lib/utils';

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
  ai_model?: string | null;
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

interface PaginationInfo {
  total: number;
  limit: number;
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
    vote_a: VoteType;
    vote_b: VoteType;
  }>;
  askThemAbout: Array<{
    question_id: string;
    content: string;
    their_vote: VoteType;
  }>;
  shareYourTake: Array<{
    question_id: string;
    content: string;
    your_vote: VoteType;
  }>;
  currentUserId?: string;
  createdQuestions: CreatedQuestion[];
  pagination: {
    responses: PaginationInfo;
    questions: PaginationInfo;
  };
}

type Tab = 'stances' | 'questions' | 'comparison' | 'rankings';
type StanceFilter = 'all' | 'YES' | 'NO' | 'UNSURE';

export function AIProfileClient({
  profile,
  responses: initialResponses,
  stats,
  compatibility,
  commonGround,
  divergence,
  askThemAbout,
  shareYourTake,
  currentUserId,
  createdQuestions: initialQuestions,
  pagination,
}: AIProfileClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const [activeTab, setActiveTab] = useState<Tab>(compatibility ? 'comparison' : 'stances');
  const [stanceFilter, setStanceFilter] = useState<StanceFilter>('all');

  // Pagination state for responses/votes
  const [responses, setResponses] = useState<ResponseWithQuestion[]>(initialResponses);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [responsesHasMore, setResponsesHasMore] = useState(
    initialResponses.length < pagination.responses.total
  );

  // Pagination state for questions
  const [createdQuestions, setCreatedQuestions] = useState<CreatedQuestion[]>(initialQuestions);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsHasMore, setQuestionsHasMore] = useState(
    initialQuestions.length < pagination.questions.total
  );

  // Load more responses/votes
  const loadMoreResponses = async () => {
    if (responsesLoading || !responsesHasMore) return;
    
    setResponsesLoading(true);
    try {
      const { data: rawResponses } = await supabase
        .from('responses')
        .select(`
          id,
          vote,
          updated_at,
          ai_reasoning,
          ai_model,
          question:questions (
            id,
            content,
            created_at,
            author_id
          )
        `)
        .eq('is_ai', true)
        .order('updated_at', { ascending: false })
        .range(responses.length, responses.length + pagination.responses.limit - 1);
      
      if (rawResponses && rawResponses.length > 0) {
        const newResponses = rawResponses.map((r) => ({
          id: r.id as string,
          vote: r.vote as VoteType,
          updated_at: r.updated_at as string,
          ai_reasoning: r.ai_reasoning as string | null,
          ai_model: r.ai_model as string | null,
          question: Array.isArray(r.question) ? r.question[0] : r.question,
        }));
        
        setResponses(prev => [...prev, ...newResponses]);
        setResponsesHasMore(responses.length + newResponses.length < pagination.responses.total);
      } else {
        setResponsesHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more AI responses:', err);
    }
    setResponsesLoading(false);
  };

  // Load more questions
  const loadMoreQuestions = async () => {
    if (questionsLoading || !questionsHasMore) return;
    
    setQuestionsLoading(true);
    try {
      const { data: newQuestions } = await supabase
        .from('questions')
        .select('id, content, created_at, image_url')
        .eq('is_ai', true)
        .order('created_at', { ascending: false })
        .range(createdQuestions.length, createdQuestions.length + pagination.questions.limit - 1);
      
      if (newQuestions && newQuestions.length > 0) {
        setCreatedQuestions(prev => [...prev, ...newQuestions]);
        setQuestionsHasMore(createdQuestions.length + newQuestions.length < pagination.questions.total);
      } else {
        setQuestionsHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more AI questions:', err);
    }
    setQuestionsLoading(false);
  };

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
          label={`Questions (${pagination.questions.total})`}
        />
        {compatibility && (
          <TabButton
            active={activeTab === 'comparison'}
            onClick={() => setActiveTab('comparison')}
            icon={Handshake}
            label="Relationship"
          />
        )}
        <TabButton
          active={activeTab === 'rankings'}
          onClick={() => setActiveTab('rankings')}
          icon={Users}
          label="Compare"
        />
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

          {/* Load More Button */}
          {stanceFilter === 'all' && responsesHasMore && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={loadMoreResponses}
                disabled={responsesLoading}
                className="gap-2"
              >
                {responsesLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Load More
                    <span className="text-xs text-zinc-500">
                      ({pagination.responses.total - responses.length} remaining)
                    </span>
                  </>
                )}
              </Button>
            </div>
          )}
          {stanceFilter === 'all' && !responsesHasMore && responses.length > 0 && (
            <p className="mt-4 text-center text-sm text-zinc-400">
              You&apos;ve reached the end
            </p>
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

          {/* Load More Button */}
          {questionsHasMore && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={loadMoreQuestions}
                disabled={questionsLoading}
                className="gap-2"
              >
                {questionsLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Load More
                    <span className="text-xs text-zinc-500">
                      ({pagination.questions.total - createdQuestions.length} remaining)
                    </span>
                  </>
                )}
              </Button>
            </div>
          )}
          {!questionsHasMore && createdQuestions.length > 0 && (
            <p className="mt-4 text-center text-sm text-zinc-400">
              You&apos;ve reached the end
            </p>
          )}
        </div>
      )}

      {activeTab === 'comparison' && (
        <div className="space-y-6">
          <CommonGroundCard 
            items={commonGround} 
            icon={Heart}
            showControversy={false}
          />
          
          <DivergenceCard 
            items={divergence} 
            icon={Swords}
            labelB="AI"
          />
          
          <AskThemAboutCard 
            items={askThemAbout} 
            icon={Lightbulb}
          />
          
          <ShareYourTakeCard 
            items={shareYourTake} 
            icon={MessageSquareShare}
          />

          {/* Empty state */}
          {commonGround.length === 0 && divergence.length === 0 && askThemAbout.length === 0 && shareYourTake.length === 0 && (
            <p className="py-8 text-center text-zinc-500">No comparison data yet. Vote on more questions to see how you compare with the AI!</p>
          )}
        </div>
      )}

      {activeTab === 'rankings' && (
        <AgreementRankings 
          profileUserId="ai" 
          profileUsername="AI"
        />
      )}
    </div>
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
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm text-zinc-900 dark:text-zinc-100">
                {response.question.content}
              </p>
              {response.ai_model && (() => {
                const modelInfo = getModelDisplayInfo(response.ai_model);
                return (
                  <span className={cn(
                    "px-1.5 py-0.5 text-[10px] font-medium rounded",
                    modelInfo.bgColor,
                    modelInfo.textColor
                  )}>
                    {modelInfo.shortName}
                  </span>
                );
              })()}
            </div>
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
