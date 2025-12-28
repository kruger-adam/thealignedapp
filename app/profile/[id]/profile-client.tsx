'use client';

import { useState } from 'react';
import {
  Check,
  X,
  HelpCircle,
  Clock,
  TrendingUp,
  Heart,
  Swords,
  RotateCcw,
  LogOut,
  Vote,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Profile, VoteType, Compatibility, CommonGround, Divergence } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';

interface ResponseWithQuestion {
  id: string;
  vote: VoteType;
  updated_at: string;
  question: {
    id: string;
    content: string;
    created_at: string;
    author_id: string;
  } | null;
}

interface HistoryItem {
  id: string;
  previous_vote: VoteType | null;
  new_vote: VoteType;
  changed_at: string;
  question: {
    id: string;
    content: string;
  } | null;
}

interface CreatedQuestion {
  id: string;
  content: string;
  created_at: string;
}

interface ProfileClientProps {
  profile: Profile;
  isOwnProfile: boolean;
  responses: ResponseWithQuestion[];
  history: HistoryItem[];
  stats: {
    totalVotes: number;
    yesCount: number;
    noCount: number;
    unsureCount: number;
    changedVotes: number;
  };
  compatibility: Compatibility | null;
  commonGround: CommonGround[] | null;
  divergence: Divergence[] | null;
  currentUserId?: string;
  createdQuestions: CreatedQuestion[];
}

type Tab = 'stances' | 'questions' | 'history' | 'comparison';
type StanceFilter = 'all' | 'YES' | 'NO' | 'UNSURE';

const voteConfig = {
  YES: { icon: Check, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Yes' },
  NO: { icon: X, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/30', label: 'No' },
  UNSURE: { icon: HelpCircle, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30', label: 'Not Sure' },
};

export function ProfileClient({
  profile,
  isOwnProfile,
  responses,
  history,
  stats,
  compatibility,
  commonGround,
  divergence,
  currentUserId,
  createdQuestions,
}: ProfileClientProps) {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>(
    isOwnProfile ? 'stances' : compatibility ? 'comparison' : 'stances'
  );
  const [stanceFilter, setStanceFilter] = useState<StanceFilter>('all');

  const filteredResponses = responses.filter(
    (r) => stanceFilter === 'all' || r.vote === stanceFilter
  );

  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Profile Header */}
      <Card className="mb-6 overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800" />
        <CardContent className="relative pb-6 pt-0">
          <div className="-mt-12 mb-3">
            <Avatar
              src={profile.avatar_url}
              fallback={profile.username || profile.email}
              size="lg"
              className="h-20 w-20 border-4 border-white shadow-lg dark:border-zinc-900"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {profile.username || 'Anonymous'}
            </h1>
            <p className="text-sm text-zinc-500">Member since {memberSince}</p>
          </div>

          {/* Stats Row */}
          <div className="mt-6 grid grid-cols-5 gap-3">
            <StatBox label="Votes" value={stats.totalVotes} icon={Vote} />
            <StatBox label="Yes" value={stats.yesCount} icon={Check} className="text-emerald-600" />
            <StatBox label="No" value={stats.noCount} icon={X} className="text-rose-600" />
            <StatBox label="Not Sure" value={stats.unsureCount} icon={HelpCircle} className="text-amber-600" />
            <StatBox label="Changed" value={stats.changedVotes} icon={RotateCcw} className="text-violet-600" />
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

          {/* Sign Out Button (only on own profile) */}
          {isOwnProfile && (
            <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="w-full gap-2 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compatibility Banner (when viewing another profile) */}
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
                    {compatibility.compatibility_score}%
                  </p>
                </div>
              </div>
              <div className="text-right text-sm text-violet-600 dark:text-violet-400">
                <p>{compatibility.agreements} agreements</p>
                <p>{compatibility.disagreements} disagreements</p>
                <p className="text-xs opacity-75">
                  {compatibility.common_questions} shared questions
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800/50">
        <TabButton
          active={activeTab === 'stances'}
          onClick={() => setActiveTab('stances')}
          icon={Vote}
          label={isOwnProfile ? 'My Votes' : 'Votes'}
        />
        <TabButton
          active={activeTab === 'questions'}
          onClick={() => setActiveTab('questions')}
          icon={HelpCircle}
          label={`Questions (${createdQuestions.length})`}
        />
        {isOwnProfile && (
          <TabButton
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            icon={Clock}
            label="History"
          />
        )}
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
            <p className="py-8 text-center text-zinc-500">No stances to show.</p>
          ) : (
            <div className="space-y-2">
              {filteredResponses.map((response) => (
                <StanceItem key={response.id} response={response} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'questions' && (
        <div className="space-y-2">
          {createdQuestions.length === 0 ? (
            <p className="py-8 text-center text-zinc-500">No questions created yet.</p>
          ) : (
            createdQuestions.map((question) => (
              <div
                key={question.id}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="rounded-full bg-zinc-100 p-2 dark:bg-zinc-800">
                  <HelpCircle className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-zinc-900 dark:text-zinc-100">
                    {question.content}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {new Date(question.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="py-8 text-center text-zinc-500">No vote history yet.</p>
          ) : (
            history.map((item) => <HistoryItem key={item.id} item={item} />)
          )}
        </div>
      )}

      {activeTab === 'comparison' && (
        <div className="space-y-6">
          {/* Common Ground */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-emerald-600">
                <Heart className="h-5 w-5" />
                Common Ground
              </CardTitle>
            </CardHeader>
            <CardContent>
              {commonGround && commonGround.length > 0 ? (
                <div className="space-y-2">
                  {commonGround.map((item) => (
                    <div
                      key={item.question_id}
                      className="flex items-center gap-3 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30"
                    >
                      <div className={cn('rounded-full p-1.5', voteConfig[item.shared_vote].bg)}>
                        {(() => {
                          const Icon = voteConfig[item.shared_vote].icon;
                          return <Icon className={cn('h-4 w-4', voteConfig[item.shared_vote].color)} />;
                        })()}
                      </div>
                      <p className="flex-1 text-sm">{item.content}</p>
                      <span className="text-xs text-zinc-500">
                        {Math.round(item.controversy_score)}% split
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No common ground found yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Divergence */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-rose-600">
                <Swords className="h-5 w-5" />
                Where You Differ
              </CardTitle>
            </CardHeader>
            <CardContent>
              {divergence && divergence.length > 0 ? (
                <div className="space-y-2">
                  {divergence.map((item) => (
                    <div
                      key={item.question_id}
                      className="flex items-center gap-3 rounded-lg bg-rose-50 p-3 dark:bg-rose-950/30"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1 text-xs">
                          <span className="font-medium">You:</span>
                          <span className={voteConfig[item.vote_a].color}>
                            {voteConfig[item.vote_a].label}
                          </span>
                        </span>
                        <span className="flex items-center gap-1 text-xs">
                          <span className="font-medium">They:</span>
                          <span className={voteConfig[item.vote_b].color}>
                            {voteConfig[item.vote_b].label}
                          </span>
                        </span>
                      </div>
                      <p className="flex-1 text-sm">{item.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No disagreements found!</p>
              )}
            </CardContent>
          </Card>
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

function StanceItem({ response }: { response: ResponseWithQuestion }) {
  if (!response.question) return null;

  const config = voteConfig[response.vote];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className={cn('rounded-full p-2', config.bg)}>
        <Icon className={cn('h-4 w-4', config.color)} />
      </div>
      <p className="flex-1 text-sm text-zinc-900 dark:text-zinc-100">
        {response.question.content}
      </p>
    </div>
  );
}

function HistoryItem({ item }: { item: HistoryItem }) {
  if (!item.question) return null;

  const isInitialVote = !item.previous_vote;
  const date = new Date(item.changed_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900">
        <RotateCcw className="h-4 w-4 text-violet-600 dark:text-violet-400" />
      </div>
      <div className="flex-1">
        <p className="text-sm text-zinc-900 dark:text-zinc-100">
          {item.question.content}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
          <span>{date}</span>
          <span>•</span>
          {isInitialVote ? (
            <span>
              Voted{' '}
              <span className={voteConfig[item.new_vote].color}>
                {voteConfig[item.new_vote].label}
              </span>
            </span>
          ) : (
            <span>
              <span className={voteConfig[item.previous_vote!].color}>
                {voteConfig[item.previous_vote!].label}
              </span>
              {' → '}
              <span className={voteConfig[item.new_vote].color}>
                {voteConfig[item.new_vote].label}
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}


