'use client';

import Link from 'next/link';
import { Bot, Lock } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Voter, VoteType } from '@/lib/types';

interface VoterListProps {
  voters: Voter[];
  anonymousCounts: { YES: number; NO: number; UNSURE: number };
}

export function VoterList({ voters, anonymousCounts }: VoterListProps) {
  const yesVoters = voters.filter(v => v.vote === 'YES');
  const noVoters = voters.filter(v => v.vote === 'NO');
  const unsureVoters = voters.filter(v => v.vote === 'UNSURE');

  const renderVoterChip = (voter: Voter, voteType: VoteType, idx: number) => {
    const colorClasses = {
      YES: {
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        hoverBg: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/40',
        text: 'text-emerald-700 dark:text-emerald-300',
      },
      NO: {
        bg: 'bg-rose-50 dark:bg-rose-950/30',
        hoverBg: 'hover:bg-rose-100 dark:hover:bg-rose-900/40',
        text: 'text-rose-700 dark:text-rose-300',
      },
      UNSURE: {
        bg: 'bg-amber-50 dark:bg-amber-950/30',
        hoverBg: 'hover:bg-amber-100 dark:hover:bg-amber-900/40',
        text: 'text-amber-700 dark:text-amber-300',
      },
    };

    const colors = colorClasses[voteType];

    if (voter.is_ai) {
      return (
        <Link key={`ai-${voteType.toLowerCase()}-${idx}`} href="/profile/ai">
          <div
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-100 to-indigo-100 py-1 pl-1 pr-2.5 transition-opacity hover:opacity-80 dark:from-violet-950/40 dark:to-indigo-950/40"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500">
              <Bot className="h-3 w-3 text-white" />
            </div>
            <span className="text-xs font-medium bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              AI
            </span>
          </div>
        </Link>
      );
    }

    return (
      <Link key={voter.id} href={`/profile/${voter.id}`}>
        <div
          className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 transition-colors ${colors.bg} ${colors.hoverBg}`}
        >
          <Avatar src={voter.avatar_url} fallback={voter.username || ''} size="sm" className="h-5 w-5" />
          <span className={`text-xs ${colors.text}`}>{voter.username}</span>
        </div>
      </Link>
    );
  };

  const renderAnonymousChip = (count: number, voteType: VoteType) => {
    if (count === 0) return null;

    const colorClasses = {
      YES: {
        bg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
        icon: 'text-emerald-400',
        text: 'text-emerald-500 dark:text-emerald-400',
      },
      NO: {
        bg: 'bg-rose-50/50 dark:bg-rose-950/20',
        icon: 'text-rose-400',
        text: 'text-rose-500 dark:text-rose-400',
      },
      UNSURE: {
        bg: 'bg-amber-50/50 dark:bg-amber-950/20',
        icon: 'text-amber-400',
        text: 'text-amber-500 dark:text-amber-400',
      },
    };

    const colors = colorClasses[voteType];

    return (
      <div className={`flex items-center gap-1.5 rounded-full py-1 px-2.5 ${colors.bg}`}>
        <Lock className={`h-3 w-3 ${colors.icon}`} />
        <span className={`text-xs italic ${colors.text}`}>+{count} privately</span>
      </div>
    );
  };

  const renderVoteSection = (
    voteType: VoteType,
    votersList: Voter[],
    label: string,
    labelColor: string
  ) => {
    const anonCount = anonymousCounts[voteType as keyof typeof anonymousCounts] || 0;
    if (votersList.length === 0 && anonCount === 0) return null;

    return (
      <div>
        <p className={`mb-1.5 text-xs font-medium ${labelColor}`}>{label}</p>
        <div className="flex flex-wrap gap-2">
          {votersList.map((voter, idx) => renderVoterChip(voter, voteType, idx))}
          {renderAnonymousChip(anonCount, voteType)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {renderVoteSection('YES', yesVoters, 'Yes', 'text-emerald-600')}
      {renderVoteSection('NO', noVoters, 'No', 'text-rose-600')}
      {renderVoteSection('UNSURE', unsureVoters, 'Not Sure / Depends', 'text-amber-600')}
    </div>
  );
}

