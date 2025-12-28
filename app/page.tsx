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
  const supabase = useMemo(() => createClient(), []);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);

    // Fetch questions with their stats
    const { data: questionsData, error: questionsError } = await supabase
      .from('question_stats')
      .select('*');

    if (questionsError || !questionsData) {
      console.error('Error fetching questions:', questionsError);
      setLoading(false);
      return;
    }

    // Fetch user's votes if logged in
    let userVotes: Record<string, VoteType> = {};
    if (user) {
      const { data: votesData } = await supabase
        .from('responses')
        .select('question_id, vote')
        .eq('user_id', user.id);

      if (votesData) {
        userVotes = Object.fromEntries(
          votesData.map((v) => [v.question_id, v.vote as VoteType])
        );
      }
    }

    // Fetch author profiles
    const authorIds = [...new Set(questionsData.map((q) => q.author_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', authorIds);

    const profilesMap = Object.fromEntries(
      (profiles || []).map((p) => [p.id, p])
    );

    // Transform data
    const transformedQuestions: QuestionWithStats[] = questionsData.map((q) => ({
      id: q.question_id,
      author_id: q.author_id,
      content: q.content,
      created_at: q.created_at,
      updated_at: q.created_at,
      author: profilesMap[q.author_id],
      stats: {
        total_votes: q.total_votes,
        yes_count: q.yes_count,
        no_count: q.no_count,
        unsure_count: q.unsure_count,
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
  }, [user, sortBy, supabase]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Realtime subscription for new questions and votes
  useEffect(() => {
    const channel = supabase
      .channel('realtime-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'questions' },
        () => {
          fetchQuestions();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'responses' },
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
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Feed
          </h1>
          <FeedFilters currentSort={sortBy} onSortChange={setSortBy} />
        </div>
        <CreateQuestion onQuestionCreated={fetchQuestions} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      ) : questions.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-lg text-zinc-500">No questions yet.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Be the first to ask something!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((question, index) => (
            <div
              key={question.id}
              className="animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <QuestionCard
                question={question}
                authorName={question.author?.username || undefined}
                authorAvatar={question.author?.avatar_url}
                onVote={() => fetchQuestions()}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
