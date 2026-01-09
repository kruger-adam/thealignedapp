'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Loader2, ChevronDown } from 'lucide-react';
import { QuestionCard } from '@/components/question-card';
import { CreateQuestion } from '@/components/create-question';
import { FeedFilters } from '@/components/feed-filters';
import { CategoryPills } from '@/components/category-pills';
import { Search } from '@/components/search';
import { LandingPage } from '@/components/landing-page';
import { OnboardingFlow } from '@/components/onboarding';
import { AICountdown } from '@/components/ai-countdown';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';
import { FEATURES } from '@/lib/features';
import { QuestionWithStats, SortOption, VoteType, Category } from '@/lib/types';
import { useFeedPreferences } from '@/hooks/use-feed-preferences';

const PAGE_SIZE = 15;
const ONBOARDING_TARGET_VOTES = 10;

export default function FeedPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    preferences,
    isInitialized: prefsInitialized,
    setSortBy,
    setCategoryFilter,
    setMinVotes,
    setTimePeriod,
    setPollStatus,
    setAuthorType,
  } = useFeedPreferences();
  
  const { sortBy, categoryFilter, minVotes, timePeriod, pollStatus, authorType } = preferences;
  
  const [questions, setQuestions] = useState<QuestionWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // Sort options for the dropdown
  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'newest', label: 'Newest' },
    { value: 'popular', label: 'Most Votes' },
    { value: 'most_commented', label: 'Most Commented' },
    { value: 'controversial', label: 'Most Split' },
    { value: 'consensus', label: 'Most Agreed' },
    { value: 'most_undecided', label: 'Most Undecided' },
    { value: 'most_sensitive', label: 'Most Sensitive' },
  ];

  // Close sort dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Onboarding state
  const [onboardingVoteCount, setOnboardingVoteCount] = useState<number | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(false);
  const [onboardingCategory, setOnboardingCategory] = useState<Category | null>(null);
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);

  // Check if user needs onboarding (controlled by feature flag)
  const showOnboarding = FEATURES.ONBOARDING_FLOW && user && onboardingLoaded && onboardingVoteCount !== null && onboardingVoteCount < ONBOARDING_TARGET_VOTES;

  // Fetch onboarding data when user loads (only if feature is enabled)
  useEffect(() => {
    async function fetchOnboardingData() {
      if (!FEATURES.ONBOARDING_FLOW || !user) {
        setOnboardingLoaded(true);
        return;
      }

      try {
        // Fetch user's vote count (non-AI votes only)
        const { count: voteCount } = await supabase
          .from('responses')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_ai', false);

        // Fetch onboarding_dismissed from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_dismissed')
          .eq('id', user.id)
          .single();

        setOnboardingVoteCount(voteCount ?? 0);
        setOnboardingDismissed(profile?.onboarding_dismissed ?? false);
        setOnboardingLoaded(true);
      } catch (error) {
        console.error('Error fetching onboarding data:', error);
        setOnboardingLoaded(true);
      }
    }

    fetchOnboardingData();
  }, [user, supabase]);

  // Handle onboarding category selection - this sets the feed filter
  const handleOnboardingCategorySelect = useCallback((category: Category) => {
    setOnboardingCategory(category);
    setCategoryFilter(category);
  }, [setCategoryFilter]);

  // Filters are always applied before pagination in fetchQuestions now
  // So we just use questions directly - no need for additional client-side filtering
  const filteredQuestions = questions;

  const fetchQuestions = useCallback(async (append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setOffset(0);
      setHasMore(true);
    }

    const currentOffset = append ? offset : 0;

    try {
      // Build server-side query with filters and sorting
      // The database now has denormalized count columns: yes_count, no_count, unsure_count, 
      // total_votes, anonymous_vote_count, comment_count
      
      // Determine sort order for the query
      // "controversial" and "consensus" still need client-side sorting (require ratio calculations)
      // "unansweredOnly" also requires client-side filtering (needs user's vote data)
      const needsClientSort = ['controversial', 'consensus'].includes(sortBy);
      const needsClientFilter = unansweredOnly;
      const needsFullFetch = needsClientSort || needsClientFilter;
      
      // Build ORDER BY clause based on sort option
      let orderClause: string;
      switch (sortBy) {
        case 'popular':
          orderClause = 'total_votes.desc,created_at.desc';
          break;
        case 'most_commented':
          orderClause = 'comment_count.desc,created_at.desc';
          break;
        case 'most_undecided':
          orderClause = 'unsure_count.desc,created_at.desc';
          break;
        case 'most_sensitive':
          orderClause = 'anonymous_vote_count.desc,created_at.desc';
          break;
        case 'controversial':
        case 'consensus':
          // These need client-side sorting, but we can pre-sort by total_votes as a starting point
          orderClause = 'total_votes.desc,created_at.desc';
          break;
        case 'newest':
        default:
          orderClause = 'created_at.desc';
          break;
      }
      
      // Build filter conditions
      const filters: string[] = [];
      
      if (categoryFilter) {
        filters.push(`category=eq.${encodeURIComponent(categoryFilter)}`);
      }
      
      if (minVotes > 0) {
        filters.push(`total_votes=gte.${minVotes}`);
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
        filters.push(`created_at=gte.${cutoff.toISOString()}`);
      }
      
      if (pollStatus !== 'all') {
        const now = new Date().toISOString();
        if (pollStatus === 'active') {
          // Active: expires_at is null OR expires_at > now
          filters.push(`or=(expires_at.is.null,expires_at.gt.${now})`);
        } else {
          // Expired: expires_at is not null AND expires_at <= now
          filters.push(`expires_at=not.is.null`);
          filters.push(`expires_at=lte.${now}`);
        }
      }
      
      if (authorType !== 'all') {
        filters.push(`is_ai=eq.${authorType === 'ai'}`);
      }
      
      // Build URL
      let url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/questions?select=*`;
      
      // Add filters
      if (filters.length > 0) {
        url += `&${filters.join('&')}`;
      }
      
      // Add ordering
      url += `&order=${orderClause}`;
      
      // Add pagination (only if we don't need full fetch for client-side processing)
      if (!needsFullFetch) {
        url += `&limit=${PAGE_SIZE}&offset=${currentOffset}`;
      }
      
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
        setLoadingMore(false);
        return;
      }

      // Check if we got fewer results than requested (no more pages)
      if (!needsFullFetch && (!rawQuestions || rawQuestions.length < PAGE_SIZE)) {
        setHasMore(false);
      }

      // If no questions and not appending, show empty state
      if (!rawQuestions || rawQuestions.length === 0) {
        if (!append) {
          setQuestions([]);
        }
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      // Define the raw question type with new columns
      interface RawQuestion {
        id: string;
        author_id: string | null;
        content: string;
        category: string | null;
        image_url: string | null;
        created_at: string;
        updated_at: string;
        expires_at: string | null;
        is_ai: boolean;
        is_anonymous: boolean;
        yes_count: number;
        no_count: number;
        unsure_count: number;
        total_votes: number;
        anonymous_vote_count: number;
        comment_count: number;
      }

      // Fetch user's votes if logged in - exclude AI votes
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

      // Fetch author profiles
      const authorIds = [...new Set((rawQuestions as RawQuestion[]).map((q) => q.author_id).filter((id): id is string => id !== null))];
      let profilesMap: Record<string, { id: string; username: string | null; avatar_url: string | null }> = {};
      
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

      // Transform data - stats now come directly from the database
      const transformedQuestions: QuestionWithStats[] = (rawQuestions as RawQuestion[]).map((q) => {
        const total = q.total_votes;
        return {
          id: q.id,
          author_id: q.author_id,
          content: q.content,
          category: q.category as import('@/lib/types').Category | undefined,
          image_url: q.image_url,
          created_at: q.created_at,
          updated_at: q.updated_at,
          expires_at: q.expires_at,
          is_ai: q.is_ai || false,
          is_anonymous: q.is_anonymous || false,
          author: (q.author_id && !q.is_anonymous) ? profilesMap[q.author_id] : undefined,
          stats: {
            total_votes: total,
            yes_count: q.yes_count,
            no_count: q.no_count,
            unsure_count: q.unsure_count,
            anonymous_count: q.anonymous_vote_count,
            comment_count: q.comment_count,
            yes_percentage: total > 0 ? Math.round((q.yes_count / total) * 100) : 0,
            no_percentage: total > 0 ? Math.round((q.no_count / total) * 100) : 0,
            unsure_percentage: total > 0 ? Math.round((q.unsure_count / total) * 100) : 0,
            controversy_score: 0,
          },
          user_vote: userVotes[q.id]?.vote || null,
          user_vote_is_anonymous: userVotes[q.id]?.is_anonymous || false,
        };
      });

      // Apply client-side sorting if needed (for controversial/consensus)
      let processedQuestions = transformedQuestions;
      
      if (needsClientSort) {
        // Helper: Calculate split/agreement scores
        const getScores = (stats: typeof transformedQuestions[0]['stats']) => {
          const decisiveVotes = stats.yes_count + stats.no_count;
          if (decisiveVotes === 0) {
            return { splitScore: 0, agreementScore: 0, decisiveVotes: 0 };
          }
          const yesRatio = stats.yes_count / decisiveVotes;
          const splitScore = 100 - Math.abs(yesRatio - 0.5) * 200;
          const agreementScore = (Math.max(stats.yes_count, stats.no_count) / decisiveVotes) * 100;
          return { splitScore, agreementScore, decisiveVotes };
        };

        processedQuestions = [...transformedQuestions].sort((a, b) => {
          if (sortBy === 'controversial') {
            const aScores = getScores(a.stats);
            const bScores = getScores(b.stats);
            if (bScores.splitScore !== aScores.splitScore) {
              return bScores.splitScore - aScores.splitScore;
            }
            return bScores.decisiveVotes - aScores.decisiveVotes;
          } else if (sortBy === 'consensus') {
            const aScores = getScores(a.stats);
            const bScores = getScores(b.stats);
            if (bScores.agreementScore !== aScores.agreementScore) {
              return bScores.agreementScore - aScores.agreementScore;
            }
            return bScores.decisiveVotes - aScores.decisiveVotes;
          }
          return 0;
        });
      }

      // Apply client-side filter for unanswered only
      if (unansweredOnly) {
        processedQuestions = processedQuestions.filter(q => !q.user_vote);
      }

      // Handle pagination for full-fetch mode
      if (needsFullFetch) {
        const startIndex = currentOffset;
        const endIndex = currentOffset + PAGE_SIZE;
        const paginatedResults = processedQuestions.slice(startIndex, endIndex);
        
        if (endIndex >= processedQuestions.length) {
          setHasMore(false);
        }
        
        if (append) {
          setQuestions(prev => [...prev, ...paginatedResults]);
          setOffset(endIndex);
        } else {
          setQuestions(paginatedResults);
          setOffset(PAGE_SIZE);
        }
      } else {
        if (append) {
          setQuestions(prev => [...prev, ...processedQuestions]);
          setOffset(currentOffset + rawQuestions.length);
        } else {
          setQuestions(processedQuestions);
          setOffset(rawQuestions.length);
        }
      }
      
      setLoading(false);
      setLoadingMore(false);
    } catch (err) {
      console.error('Fetch error:', err);
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, sortBy, offset, categoryFilter, minVotes, timePeriod, unansweredOnly, pollStatus, authorType]);

  // Reset and fetch when sort changes or user changes (wait for preferences to load)
  useEffect(() => {
    if (prefsInitialized) {
      fetchQuestions(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, sortBy, prefsInitialized]);

  // Refetch when filters change (filters require fetching all data to apply correctly)
  useEffect(() => {
    if (prefsInitialized) {
      fetchQuestions(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, minVotes, timePeriod, unansweredOnly, pollStatus, authorType]);

  // Load more when user scrolls to bottom
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      fetchQuestions(true);
    }
  }, [loadingMore, hasMore, loading, fetchQuestions]);

  // Intersection observer for infinite scroll
  // rootMargin triggers load 800px before reaching the bottom (roughly 3-4 posts early)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '800px' }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [loadMore]);

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
    <div className="mx-auto max-w-2xl px-4 py-6 pb-fab-safe">
      {/* Onboarding Flow */}
      {showOnboarding && user && (
        <OnboardingFlow
          userId={user.id}
          initialVoteCount={onboardingVoteCount ?? 0}
          initialDismissed={onboardingDismissed}
          onCategorySelect={handleOnboardingCategorySelect}
          selectedCategory={onboardingCategory}
        />
      )}
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Feed
            </h1>
            <div className="relative inline-block" ref={sortDropdownRef}>
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              >
                <span>Sorted by</span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {sortOptions.find(s => s.value === sortBy)?.label}
                </span>
                <ChevronDown className={`h-3 w-3 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showSortDropdown && (
                <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                  {sortOptions.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => {
                        setSortBy(value);
                        setShowSortDropdown(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-sm transition-colors ${
                        sortBy === value
                          ? 'bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100'
                          : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-700/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Search />
            <FeedFilters 
              minVotes={minVotes}
              onMinVotesChange={setMinVotes}
              timePeriod={timePeriod}
              onTimePeriodChange={setTimePeriod}
              unansweredOnly={unansweredOnly}
              onUnansweredChange={setUnansweredOnly}
              pollStatus={pollStatus}
              onPollStatusChange={setPollStatus}
              authorType={authorType}
              onAuthorTypeChange={setAuthorType}
              isLoggedIn={!!user}
            />
          </div>
        </div>
        <CreateQuestion onQuestionCreated={fetchQuestions} />
        
        {/* AI Question Countdown */}
        <AICountdown />
        
        {/* Category pills */}
        <CategoryPills 
          selected={categoryFilter} 
          onChange={setCategoryFilter} 
        />
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
              style={{ animationDelay: `${Math.min(index, 10) * 50}ms` }}
            >
              <QuestionCard
                question={question}
                authorName={question.author?.username || undefined}
                authorAvatar={question.author?.avatar_url}
              />
            </div>
          ))}
          
          {/* Infinite scroll trigger */}
          <div ref={loadMoreRef} className="py-4">
            {loadingMore && (
              <div className="flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
              </div>
            )}
            {!hasMore && filteredQuestions.length > 0 && (
              <p className="text-center text-sm text-zinc-400">
                You&apos;ve seen all the questions
              </p>
            )}
          </div>
          
          {/* Extra padding when onboarding progress bar is visible */}
          {showOnboarding && <div className="h-24" />}
        </div>
      )}
    </div>
  );
}
