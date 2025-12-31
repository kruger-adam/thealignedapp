'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { QuestionCard } from '@/components/question-card';
import { CreateQuestion } from '@/components/create-question';
import { FeedFilters } from '@/components/feed-filters';
import { Search } from '@/components/search';
import { LandingPage } from '@/components/landing-page';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';
import { QuestionWithStats, SortOption, VoteType } from '@/lib/types';
import { MinVotes, TimePeriod } from '@/components/feed-filters';

export default function FeedPage() {
  const { user, loading: authLoading } = useAuth();
  const [questions, setQuestions] = useState<QuestionWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [categoryFilter, setCategoryFilter] = useState<import('@/lib/types').Category | null>(null);
  const [minVotes, setMinVotes] = useState<MinVotes>(0);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  // Filter questions by category, min votes, time period, and unanswered
  const filteredQuestions = useMemo(() => {
    let filtered = questions;
    if (categoryFilter) {
      filtered = filtered.filter(q => q.category === categoryFilter);
    }
    if (minVotes > 0) {
      filtered = filtered.filter(q => q.stats.total_votes >= minVotes);
    }
    if (timePeriod !== 'all') {
      const now = new Date();
      let cutoff: Date;
      switch (timePeriod) {
        case 'day':
          cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
      filtered = filtered.filter(q => new Date(q.created_at) >= cutoff);
    }
    if (unansweredOnly) {
      filtered = filtered.filter(q => !q.user_vote);
    }
    return filtered;
  }, [questions, categoryFilter, minVotes, timePeriod, unansweredOnly]);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);

    try {
      // Fetch questions using direct fetch (Supabase client has issues)
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/questions?select=*&order=created_at.desc`;
      const response = await fetch(url, {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      });
      
      const rawQuestions = await response.json();
      const questionsError = response.ok ? null : { message: 'Fetch failed' };

      if (questionsError) {
        console.error('Error fetching questions:', questionsError);
        setLoading(false);
        return;
      }

    // If no questions, show empty state
    if (!rawQuestions || rawQuestions.length === 0) {
      setQuestions([]);
      setLoading(false);
      return;
    }

    // Fetch all responses to calculate vote stats
    interface RawQuestion {
      id: string;
      author_id: string | null;
      content: string;
      category: string | null;
      image_url: string | null;
      created_at: string;
      updated_at: string;
      is_ai: boolean;
      is_anonymous: boolean;
    }
    
    const questionIds = (rawQuestions as RawQuestion[]).map(q => q.id);
    let allResponses: { question_id: string; vote: string; is_anonymous: boolean }[] = [];
    
    if (questionIds.length > 0) {
      const responsesUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/responses?select=question_id,vote,is_anonymous&question_id=in.(${questionIds.join(',')})`;
      const responsesRes = await fetch(responsesUrl, {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      });
      allResponses = await responsesRes.json();
    }
    
    // Fetch comment counts per question
    let allComments: { question_id: string }[] = [];
    if (questionIds.length > 0) {
      const commentsUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/comments?select=question_id&question_id=in.(${questionIds.join(',')})`;
      const commentsRes = await fetch(commentsUrl, {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      });
      allComments = await commentsRes.json();
    }
    
    // Calculate comment counts per question
    const commentCounts: Record<string, number> = {};
    for (const c of allComments) {
      commentCounts[c.question_id] = (commentCounts[c.question_id] || 0) + 1;
    }
    
    // Calculate vote stats per question
    const voteStats: Record<string, { yes: number; no: number; unsure: number; anonymous: number }> = {};
    for (const r of allResponses) {
      if (!voteStats[r.question_id]) {
        voteStats[r.question_id] = { yes: 0, no: 0, unsure: 0, anonymous: 0 };
      }
      if (r.vote === 'YES') voteStats[r.question_id].yes++;
      else if (r.vote === 'NO') voteStats[r.question_id].no++;
      else if (r.vote === 'UNSURE') voteStats[r.question_id].unsure++;
      if (r.is_anonymous) voteStats[r.question_id].anonymous++;
    }
    
    // Transform to match expected format
    const questionsData = (rawQuestions as RawQuestion[]).map((q) => {
      const stats = voteStats[q.id] || { yes: 0, no: 0, unsure: 0, anonymous: 0 };
      const total = stats.yes + stats.no + stats.unsure;
      return {
        question_id: q.id,
        author_id: q.author_id,
        content: q.content,
        category: q.category,
        image_url: q.image_url,
        created_at: q.created_at,
        updated_at: q.updated_at,
        is_ai: q.is_ai || false,
        is_anonymous: q.is_anonymous || false,
        total_votes: total,
        yes_count: stats.yes,
        no_count: stats.no,
        unsure_count: stats.unsure,
        anonymous_count: stats.anonymous,
        comment_count: commentCounts[q.id] || 0,
        yes_percentage: total > 0 ? Math.round((stats.yes / total) * 100) : 0,
        no_percentage: total > 0 ? Math.round((stats.no / total) * 100) : 0,
        unsure_percentage: total > 0 ? Math.round((stats.unsure / total) * 100) : 0,
        controversy_score: 0, // Could calculate later if needed
      };
    });

    // Fetch user's votes if logged in (using direct fetch) - exclude AI votes
    let userVotes: Record<string, { vote: VoteType; is_anonymous: boolean }> = {};
    if (user) {
      const votesUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/responses?select=question_id,vote,is_anonymous&user_id=eq.${user.id}&is_ai=eq.false`;
      const votesRes = await fetch(votesUrl, {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      });
      const votesData = await votesRes.json();

      if (votesData && Array.isArray(votesData)) {
        userVotes = Object.fromEntries(
          votesData.map((v: { question_id: string; vote: string; is_anonymous: boolean }) => [
            v.question_id, 
            { vote: v.vote as VoteType, is_anonymous: v.is_anonymous || false }
          ])
        );
      }
    }

    // Fetch author profiles (only if there are questions with authors)
    let profilesMap: Record<string, { id: string; username: string | null; avatar_url: string | null }> = {};
    
    if (questionsData.length > 0) {
      const authorIds = [...new Set(questionsData.map((q) => q.author_id).filter((id): id is string => id !== null))];
      if (authorIds.length > 0) {
        const profilesUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=id,username,avatar_url&id=in.(${authorIds.join(',')})`;
        const profilesRes = await fetch(profilesUrl, {
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
          },
        });
        const profiles = await profilesRes.json();

        profilesMap = Object.fromEntries(
          (profiles || []).map((p: { id: string; username: string | null; avatar_url: string | null }) => [p.id, p])
        );
      }
    }

    // Transform data
    const transformedQuestions: QuestionWithStats[] = questionsData.map((q) => ({
      id: q.question_id,
      author_id: q.author_id,
      content: q.content,
      category: q.category as import('@/lib/types').Category | undefined,
      image_url: q.image_url,
      created_at: q.created_at,
      updated_at: q.updated_at,
      is_ai: q.is_ai,
      is_anonymous: q.is_anonymous,
      author: (q.author_id && !q.is_anonymous) ? profilesMap[q.author_id] : undefined,
      stats: {
        total_votes: q.total_votes,
        yes_count: q.yes_count,
        no_count: q.no_count,
        unsure_count: q.unsure_count,
        anonymous_count: q.anonymous_count,
        comment_count: q.comment_count,
        yes_percentage: q.yes_percentage,
        no_percentage: q.no_percentage,
        unsure_percentage: q.unsure_percentage,
        controversy_score: q.controversy_score,
      },
      user_vote: userVotes[q.question_id]?.vote || null,
      user_vote_is_anonymous: userVotes[q.question_id]?.is_anonymous || false,
    }));

    // Helper: Calculate agreement score (max of yes/no ratio, ignoring unsure)
    // Returns { splitScore, agreementScore } where:
    // - splitScore: how close YES/(YES+NO) is to 50% (100 = perfectly split)
    // - agreementScore: max(YES,NO)/(YES+NO) as percentage (100 = total agreement)
    const getScores = (stats: typeof transformedQuestions[0]['stats']) => {
      const decisiveVotes = stats.yes_count + stats.no_count;
      if (decisiveVotes === 0) {
        return { splitScore: 0, agreementScore: 0, decisiveVotes: 0 };
      }
      const yesRatio = stats.yes_count / decisiveVotes;
      const splitScore = 100 - Math.abs(yesRatio - 0.5) * 200; // 100 when 50/50, 0 when 100/0
      const agreementScore = (Math.max(stats.yes_count, stats.no_count) / decisiveVotes) * 100;
      return { splitScore, agreementScore, decisiveVotes };
    };

    // Sort questions
    const sorted = [...transformedQuestions].sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return b.stats.total_votes - a.stats.total_votes;
        case 'controversial': {
          // Most Split: highest splitScore first, tiebreaker by total votes
          const aScores = getScores(a.stats);
          const bScores = getScores(b.stats);
          if (bScores.splitScore !== aScores.splitScore) {
            return bScores.splitScore - aScores.splitScore;
          }
          return bScores.decisiveVotes - aScores.decisiveVotes; // tiebreaker
        }
        case 'consensus': {
          // Most Agreed: highest agreementScore first, tiebreaker by total votes
          const aScores = getScores(a.stats);
          const bScores = getScores(b.stats);
          if (bScores.agreementScore !== aScores.agreementScore) {
            return bScores.agreementScore - aScores.agreementScore;
          }
          return bScores.decisiveVotes - aScores.decisiveVotes; // tiebreaker
        }
        case 'most_undecided':
          // Sort by highest "Not Sure" count
          return b.stats.unsure_count - a.stats.unsure_count;
        case 'most_sensitive':
          // Sort by highest anonymous/private vote count
          return b.stats.anonymous_count - a.stats.anonymous_count;
        case 'most_commented':
          // Sort by highest comment count
          return b.stats.comment_count - a.stats.comment_count;
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    setQuestions(sorted);
    setLoading(false);
    } catch (err) {
      console.error('Fetch error:', err);
      setLoading(false);
    }
  }, [user, sortBy]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Realtime subscription for new questions and votes
  // Realtime subscription for new questions only
  // (votes use optimistic updates, so no need to refetch on response changes)
  useEffect(() => {
    const channel = supabase
      .channel('realtime-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'questions' },
        () => {
          fetchQuestions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchQuestions]);

  // Show landing page for logged-out users
  if (!authLoading && !user) {
    return <LandingPage />;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Feed
            </h1>
            <p className="text-xs text-zinc-500">
              Sorted by {sortBy === 'newest' ? 'Newest' : sortBy === 'popular' ? 'Most Votes' : sortBy === 'most_commented' ? 'Most Commented' : sortBy === 'controversial' ? 'Most Split' : sortBy === 'consensus' ? 'Most Agreed' : sortBy === 'most_undecided' ? 'Most Undecided' : 'Most Sensitive'}
              {(categoryFilter || minVotes > 0 || timePeriod !== 'all' || unansweredOnly) && (
                <span>
                  {' · '}
                  {[
                    categoryFilter,
                    minVotes > 0 && `${minVotes}+ votes`,
                    timePeriod === 'day' && 'Last 24h',
                    timePeriod === 'week' && 'Last week',
                    timePeriod === 'month' && 'Last month',
                    unansweredOnly && 'Unanswered',
                  ].filter(Boolean).join(', ')}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Search />
            <FeedFilters 
              currentSort={sortBy} 
              onSortChange={setSortBy} 
              currentCategory={categoryFilter}
              onCategoryChange={setCategoryFilter}
              minVotes={minVotes}
              onMinVotesChange={setMinVotes}
              timePeriod={timePeriod}
              onTimePeriodChange={setTimePeriod}
              unansweredOnly={unansweredOnly}
              onUnansweredChange={setUnansweredOnly}
              isLoggedIn={!!user}
            />
          </div>
        </div>
        <CreateQuestion onQuestionCreated={fetchQuestions} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-lg text-zinc-500">
            {categoryFilter ? `No questions in "${categoryFilter}"` : 'No questions yet.'}
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            {categoryFilter ? 'Try a different category' : 'Be the first to ask something!'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((question, index) => (
            <div
              key={question.id}
              className="animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <QuestionCard
                question={question}
                authorName={question.author?.username || undefined}
                authorAvatar={question.author?.avatar_url}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
