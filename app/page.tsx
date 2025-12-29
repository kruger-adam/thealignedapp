'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { QuestionCard } from '@/components/question-card';
import { CreateQuestion } from '@/components/create-question';
import { FeedFilters } from '@/components/feed-filters';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';
import { QuestionWithStats, SortOption, VoteType } from '@/lib/types';

export default function FeedPage() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<QuestionWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [categoryFilter, setCategoryFilter] = useState<import('@/lib/types').Category | null>(null);
  const supabase = useMemo(() => createClient(), []);

  // Filter questions by category
  const filteredQuestions = useMemo(() => {
    if (!categoryFilter) return questions;
    return questions.filter(q => q.category === categoryFilter);
  }, [questions, categoryFilter]);

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
      author_id: string;
      content: string;
      category: string | null;
      created_at: string;
      updated_at: string;
    }
    
    const questionIds = (rawQuestions as RawQuestion[]).map(q => q.id);
    let allResponses: { question_id: string; vote: string }[] = [];
    
    if (questionIds.length > 0) {
      const responsesUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/responses?select=question_id,vote&question_id=in.(${questionIds.join(',')})`;
      const responsesRes = await fetch(responsesUrl, {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      });
      allResponses = await responsesRes.json();
    }
    
    // Calculate vote stats per question
    const voteStats: Record<string, { yes: number; no: number; unsure: number; skip: number }> = {};
    for (const r of allResponses) {
      if (!voteStats[r.question_id]) {
        voteStats[r.question_id] = { yes: 0, no: 0, unsure: 0, skip: 0 };
      }
      if (r.vote === 'YES') voteStats[r.question_id].yes++;
      else if (r.vote === 'NO') voteStats[r.question_id].no++;
      else if (r.vote === 'UNSURE') voteStats[r.question_id].unsure++;
      else if (r.vote === 'SKIP') voteStats[r.question_id].skip++;
    }
    
    // Transform to match expected format
    const questionsData = (rawQuestions as RawQuestion[]).map((q) => {
      const stats = voteStats[q.id] || { yes: 0, no: 0, unsure: 0, skip: 0 };
      // Total for percentages excludes SKIP votes
      const total = stats.yes + stats.no + stats.unsure;
      return {
        question_id: q.id,
        author_id: q.author_id,
        content: q.content,
        category: q.category,
        created_at: q.created_at,
        updated_at: q.updated_at,
        total_votes: total,
        yes_count: stats.yes,
        no_count: stats.no,
        unsure_count: stats.unsure,
        skip_count: stats.skip,
        yes_percentage: total > 0 ? Math.round((stats.yes / total) * 100) : 0,
        no_percentage: total > 0 ? Math.round((stats.no / total) * 100) : 0,
        unsure_percentage: total > 0 ? Math.round((stats.unsure / total) * 100) : 0,
        controversy_score: 0, // Could calculate later if needed
      };
    });

    // Fetch user's votes if logged in (using direct fetch)
    let userVotes: Record<string, VoteType> = {};
    if (user) {
      const votesUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/responses?select=question_id,vote&user_id=eq.${user.id}`;
      const votesRes = await fetch(votesUrl, {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      });
      const votesData = await votesRes.json();

      if (votesData && Array.isArray(votesData)) {
        userVotes = Object.fromEntries(
          votesData.map((v: { question_id: string; vote: string }) => [v.question_id, v.vote as VoteType])
        );
      }
    }

    // Fetch author profiles (only if there are questions)
    let profilesMap: Record<string, { id: string; username: string | null; avatar_url: string | null }> = {};
    
    if (questionsData.length > 0) {
      const authorIds = [...new Set(questionsData.map((q) => q.author_id))];
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

    // Transform data
    const transformedQuestions: QuestionWithStats[] = questionsData.map((q) => ({
      id: q.question_id,
      author_id: q.author_id,
      content: q.content,
      category: q.category as import('@/lib/types').Category | undefined,
      created_at: q.created_at,
      updated_at: q.updated_at,
      author: profilesMap[q.author_id],
      stats: {
        total_votes: q.total_votes,
        yes_count: q.yes_count,
        no_count: q.no_count,
        unsure_count: q.unsure_count,
        skip_count: q.skip_count,
        yes_percentage: q.yes_percentage,
        no_percentage: q.no_percentage,
        unsure_percentage: q.unsure_percentage,
        controversy_score: q.controversy_score,
      },
      user_vote: userVotes[q.question_id] || null,
    }));

    // Sort questions
    const sorted = [...transformedQuestions].sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return b.stats.total_votes - a.stats.total_votes;
        case 'controversial':
          return b.stats.controversy_score - a.stats.controversy_score;
        case 'consensus':
          // Highest consensus = lowest controversy
          return a.stats.controversy_score - b.stats.controversy_score;
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Feed
            </h1>
            <p className="text-xs text-zinc-500 sm:hidden">
              Sorted by {sortBy === 'newest' ? 'Newest' : sortBy === 'popular' ? 'Most Votes' : sortBy === 'controversial' ? 'Most Split' : 'Most Agreed'}
            </p>
          </div>
          <FeedFilters 
            currentSort={sortBy} 
            onSortChange={setSortBy} 
            currentCategory={categoryFilter}
            onCategoryChange={setCategoryFilter}
          />
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
