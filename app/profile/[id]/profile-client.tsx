'use client';

import { useState, useMemo } from 'react';
import {
  HelpCircle,
  TrendingUp,
  Heart,
  Swords,
  RotateCcw,
  LogOut,
  Vote,
  UserPlus,
  UserMinus,
  ChevronDown,
  ChevronUp,
  Lock,
  Flame,
  Lightbulb,
  MessageSquareShare,
  MessageSquare,
  Users,
  Loader2,
  Bot,
  Handshake,
  Network,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { 
  StatBox, 
  TabButton,
  TabDescription,
  CommonGroundCard, 
  DivergenceCard, 
  AskThemAboutCard, 
  ShareYourTakeCard,
  AgreementRankings,
} from '@/components/profile';
import { Profile, VoteType, Compatibility, CommonGround, Divergence, AskThemAbout, ShareYourTake } from '@/lib/types';
import { voteConfig } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';

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
  is_anonymous?: boolean;
}

interface CommentWithQuestion {
  id: string;
  content: string;
  created_at: string;
  question: {
    id: string;
    content: string;
  } | null;
}

interface FollowUser {
  id: string;
  username: string | null;
  avatar_url: string | null;
}

interface PaginationInfo {
  total: number;
  limit: number;
}

interface ProfileClientProps {
  profile: Profile;
  isOwnProfile: boolean;
  responses: ResponseWithQuestion[];
  history: HistoryItem[];
  stats: {
    totalVotes: number;
    changedVotes: number;
    voteStreak: number;
    longestStreak: number;
    crowdAlignment: number | null;
  };
  compatibility: Compatibility | null;
  commonGround: CommonGround[] | null;
  divergence: Divergence[] | null;
  askThemAbout: AskThemAbout[] | null;
  shareYourTake: ShareYourTake[] | null;
  currentUserId?: string;
  createdQuestions: CreatedQuestion[];
  comments: CommentWithQuestion[];
  followCounts: {
    followers: number;
    following: number;
  };
  isFollowing: boolean;
  pagination: {
    responses: PaginationInfo;
    questions: PaginationInfo;
    history: PaginationInfo;
    comments: PaginationInfo;
  };
}

type Tab = 'stances' | 'questions' | 'comments' | 'history' | 'comparison' | 'rankings';
type StanceFilter = 'all' | 'YES' | 'NO' | 'UNSURE';

export function ProfileClient({
  profile,
  isOwnProfile,
  responses: initialResponses,
  history: initialHistory,
  stats,
  compatibility,
  commonGround,
  divergence,
  askThemAbout,
  shareYourTake,
  currentUserId,
  createdQuestions: initialQuestions,
  comments: initialComments,
  followCounts,
  isFollowing: initialIsFollowing,
  pagination,
}: ProfileClientProps) {
  const { signOut, user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [activeTab, setActiveTab] = useState<Tab>(
    isOwnProfile ? 'stances' : compatibility ? 'comparison' : 'stances'
  );
  const [stanceFilter, setStanceFilter] = useState<StanceFilter>('all');
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [localFollowerCount, setLocalFollowerCount] = useState(followCounts.followers);
  const [followLoading, setFollowLoading] = useState(false);
  
  // Followers/Following list state
  const [showFollowList, setShowFollowList] = useState<'followers' | 'following' | null>(null);
  const [followList, setFollowList] = useState<FollowUser[]>([]);
  const [loadingFollowList, setLoadingFollowList] = useState(false);

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

  // Pagination state for history
  const [history, setHistory] = useState<HistoryItem[]>(initialHistory);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyHasMore, setHistoryHasMore] = useState(
    initialHistory.length < pagination.history.total
  );

  // Pagination state for comments
  const [comments, setComments] = useState<CommentWithQuestion[]>(initialComments);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsHasMore, setCommentsHasMore] = useState(
    initialComments.length < pagination.comments.total
  );

  const fetchFollowList = async (type: 'followers' | 'following') => {
    if (showFollowList === type) {
      setShowFollowList(null);
      return;
    }
    
    setLoadingFollowList(true);
    setShowFollowList(type);
    
    try {
      if (type === 'followers') {
        // Get users who follow this profile
        const { data: follows } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', profile.id);
        
        if (follows && follows.length > 0) {
          const userIds = follows.map(f => f.follower_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', userIds);
          
          setFollowList(profiles || []);
        } else {
          setFollowList([]);
        }
      } else {
        // Get users this profile follows
        const { data: follows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', profile.id);
        
        if (follows && follows.length > 0) {
          const userIds = follows.map(f => f.following_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', userIds);
          
          setFollowList(profiles || []);
        } else {
          setFollowList([]);
        }
      }
    } catch (err) {
      console.error('Error fetching follow list:', err);
      setFollowList([]);
    }
    setLoadingFollowList(false);
  };

  const handleFollow = async () => {
    if (!user || isOwnProfile) return;
    
    setFollowLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', profile.id);
        
        setIsFollowing(false);
        setLocalFollowerCount(prev => prev - 1);
      } else {
        // Follow
        await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: profile.id,
          });
        
        // Notify the person being followed
        await supabase.from('notifications').insert({
          user_id: profile.id,
          type: 'follow',
          actor_id: user.id,
        });
        
        // Notify your followers that you followed someone
        const { data: myFollowers } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', user.id);
        
        if (myFollowers && myFollowers.length > 0) {
          const followerNotifications = myFollowers
            .filter(f => f.follower_id !== profile.id) // Don't notify the person being followed twice
            .map(f => ({
              user_id: f.follower_id,
              type: 'follow' as const,
              actor_id: user.id,
              related_user_id: profile.id, // Who was followed
            }));
          
          if (followerNotifications.length > 0) {
            supabase.from('notifications').insert(followerNotifications);
          }
        }
        
        setIsFollowing(true);
        setLocalFollowerCount(prev => prev + 1);
      }
    } catch (err) {
      console.error('Error following/unfollowing:', err);
    }
    setFollowLoading(false);
  };

  // Load more responses/votes
  const loadMoreResponses = async () => {
    if (responsesLoading || !responsesHasMore) return;
    
    setResponsesLoading(true);
    try {
      let query = supabase
        .from('responses')
        .select(`
          id,
          vote,
          updated_at,
          is_anonymous,
          question:questions (
            id,
            content,
            created_at,
            author_id
          )
        `)
        .eq('user_id', profile.id)
        .eq('is_ai', false)
        .order('updated_at', { ascending: false })
        .range(responses.length, responses.length + pagination.responses.limit - 1);
      
      if (!isOwnProfile) {
        query = query.eq('is_anonymous', false);
      }
      
      const { data: rawResponses } = await query;
      
      if (rawResponses && rawResponses.length > 0) {
        const newResponses = rawResponses.map((r) => ({
          id: r.id as string,
          vote: r.vote as VoteType,
          updated_at: r.updated_at as string,
          is_anonymous: r.is_anonymous as boolean,
          question: Array.isArray(r.question) ? r.question[0] : r.question,
        }));
        
        setResponses(prev => [...prev, ...newResponses]);
        setResponsesHasMore(responses.length + newResponses.length < pagination.responses.total);
      } else {
        setResponsesHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more responses:', err);
    }
    setResponsesLoading(false);
  };

  // Load more questions
  const loadMoreQuestions = async () => {
    if (questionsLoading || !questionsHasMore) return;
    
    setQuestionsLoading(true);
    try {
      let query = supabase
        .from('questions')
        .select('id, content, created_at, is_anonymous')
        .eq('author_id', profile.id)
        .order('created_at', { ascending: false })
        .range(createdQuestions.length, createdQuestions.length + pagination.questions.limit - 1);
      
      if (!isOwnProfile) {
        query = query.eq('is_anonymous', false);
      }
      
      const { data: newQuestions } = await query;
      
      if (newQuestions && newQuestions.length > 0) {
        setCreatedQuestions(prev => [...prev, ...newQuestions]);
        setQuestionsHasMore(createdQuestions.length + newQuestions.length < pagination.questions.total);
      } else {
        setQuestionsHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more questions:', err);
    }
    setQuestionsLoading(false);
  };

  // Load more history (only vote changes, not initial votes)
  const loadMoreHistory = async () => {
    if (historyLoading || !historyHasMore) return;
    
    setHistoryLoading(true);
    try {
      const { data: rawHistory } = await supabase
        .from('response_history')
        .select(`
          id,
          previous_vote,
          new_vote,
          changed_at,
          question:questions (
            id,
            content
          )
        `)
        .eq('user_id', profile.id)
        .not('previous_vote', 'is', null)
        .order('changed_at', { ascending: false })
        .range(history.length, history.length + pagination.history.limit - 1);
      
      if (rawHistory && rawHistory.length > 0) {
        const newHistory = rawHistory.map((h) => ({
          id: h.id as string,
          previous_vote: h.previous_vote as VoteType | null,
          new_vote: h.new_vote as VoteType,
          changed_at: h.changed_at as string,
          question: Array.isArray(h.question) ? h.question[0] : h.question,
        }));
        
        setHistory(prev => [...prev, ...newHistory]);
        setHistoryHasMore(history.length + newHistory.length < pagination.history.total);
      } else {
        setHistoryHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more history:', err);
    }
    setHistoryLoading(false);
  };

  // Load more comments
  const loadMoreComments = async () => {
    if (commentsLoading || !commentsHasMore) return;
    
    setCommentsLoading(true);
    try {
      const { data: rawComments } = await supabase
        .from('comments')
        .select(`
          id,
          content,
          created_at,
          question:questions (
            id,
            content
          )
        `)
        .eq('user_id', profile.id)
        .eq('is_ai', false)
        .order('created_at', { ascending: false })
        .range(comments.length, comments.length + pagination.comments.limit - 1);
      
      if (rawComments && rawComments.length > 0) {
        const newComments = rawComments.map((c) => ({
          id: c.id as string,
          content: c.content as string,
          created_at: c.created_at as string,
          question: Array.isArray(c.question) ? c.question[0] : c.question,
        }));
        
        setComments(prev => [...prev, ...newComments]);
        setCommentsHasMore(comments.length + newComments.length < pagination.comments.total);
      } else {
        setCommentsHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more comments:', err);
    }
    setCommentsLoading(false);
  };

  // Filter responses by stance
  const filteredResponses = responses.filter(
    (r) => stanceFilter === 'all' || r.vote === stanceFilter
  );

  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 slide-in-from-bottom-2">
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
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {profile.username || 'Anonymous'}
              </h1>
              <p className="text-sm text-zinc-500">Member since {memberSince}</p>
              {/* Follower/Following counts */}
              <div className="mt-2 flex items-center gap-4 text-sm">
                <button
                  onClick={() => fetchFollowList('followers')}
                  className="flex items-center gap-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{localFollowerCount}</span>
                  <span>followers</span>
                  {loadingFollowList && showFollowList === 'followers' ? (
                    <span className="h-3 w-3 animate-spin rounded-full border border-zinc-400 border-t-transparent" />
                  ) : showFollowList === 'followers' ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
                <button
                  onClick={() => fetchFollowList('following')}
                  className="flex items-center gap-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{followCounts.following}</span>
                  <span>following</span>
                  {loadingFollowList && showFollowList === 'following' ? (
                    <span className="h-3 w-3 animate-spin rounded-full border border-zinc-400 border-t-transparent" />
                  ) : showFollowList === 'following' ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              </div>
              
              {/* Followers/Following List */}
              {showFollowList && (
                <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <h4 className="mb-2 text-xs font-semibold uppercase text-zinc-500">
                    {showFollowList === 'followers' ? 'Followers' : 'Following'}
                  </h4>
                  {followList.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      {showFollowList === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {followList.map(followUser => (
                        <Link
                          key={followUser.id}
                          href={`/profile/${followUser.id}`}
                          className="flex items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-2.5 text-xs shadow-sm hover:bg-zinc-100 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                        >
                          <Avatar src={followUser.avatar_url} fallback={followUser.username || 'A'} size="xs" />
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">
                            {followUser.username || 'Anonymous'}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                  
                  {/* Discover people link - only show on own profile in Following section */}
                  {isOwnProfile && showFollowList === 'following' && (
                    <Link
                      href="/users"
                      className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                    >
                      <Users className="h-4 w-4" />
                      Discover people to follow
                    </Link>
                  )}
                </div>
              )}
            </div>
            {/* Follow/Unfollow Button */}
            {!isOwnProfile && user && (
              <Button
                variant={isFollowing ? 'outline' : 'default'}
                size="sm"
                onClick={handleFollow}
                disabled={followLoading}
                className="gap-1.5"
              >
                {followLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : isFollowing ? (
                  <>
                    <UserMinus className="h-4 w-4" />
                    Unfollow
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Follow
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Stats Row */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBox label="Votes" value={stats.totalVotes} icon={Vote} />
            <StatBox label="Streak" value={stats.voteStreak} icon={Flame} className="text-orange-500" tooltip={stats.longestStreak > 0 ? `Best: ${stats.longestStreak} days` : undefined} />
            <StatBox label="Changed" value={stats.changedVotes} icon={RotateCcw} className="text-violet-600" />
            <StatBox 
              label="Crowd" 
              value={stats.crowdAlignment !== null ? `${Math.round(stats.crowdAlignment)}%` : '—'} 
              icon={Users} 
              className="text-blue-600" 
              tooltip="How often you vote with the majority"
            />
          </div>

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

      {/* Tabs */}
      <div className="mb-3 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800/50">
        <TabButton
          active={activeTab === 'stances'}
          onClick={() => setActiveTab('stances')}
          icon={Vote}
          label="Votes"
        />
        <TabButton
          active={activeTab === 'questions'}
          onClick={() => setActiveTab('questions')}
          icon={HelpCircle}
          label="Questions"
        />
        <TabButton
          active={activeTab === 'comments'}
          onClick={() => setActiveTab('comments')}
          icon={MessageSquare}
          label="Comments"
        />
        <TabButton
          active={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
          icon={RotateCcw}
          label="Changes"
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
          icon={Network}
          label="Compare"
        />
      </div>

      {/* Tab Description */}
      {activeTab === 'stances' && (
        <TabDescription 
          title="Votes" 
          description={isOwnProfile ? "How you've voted on questions" : "How they've voted on questions"} 
        />
      )}
      {activeTab === 'questions' && (
        <TabDescription 
          title="Questions" 
          description={isOwnProfile ? "Questions you've created" : "Questions they've created"} 
        />
      )}
      {activeTab === 'comments' && (
        <TabDescription 
          title="Comments" 
          description={isOwnProfile ? "Your comments on questions" : "Their comments on questions"} 
        />
      )}
      {activeTab === 'history' && (
        <TabDescription 
          title="Changes" 
          description={isOwnProfile ? "Times you changed your vote" : "Times they changed their vote"} 
        />
      )}
      {activeTab === 'comparison' && (
        <TabDescription 
          title="Relationship" 
          description="Where you agree and disagree with each other" 
        />
      )}
      {activeTab === 'rankings' && (
        <TabDescription 
          title="Compare" 
          description={isOwnProfile ? "Your agreement rate with everyone" : "Their agreement rate with everyone"} 
        />
      )}

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
        <div className="space-y-2">
          {createdQuestions.length === 0 ? (
            <p className="py-8 text-center text-zinc-500">No questions created yet.</p>
          ) : (
            createdQuestions.map((question) => (
              <Link
                key={question.id}
                href={`/question/${question.id}`}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/50"
              >
                <div className="rounded-full bg-zinc-100 p-2 dark:bg-zinc-800">
                  <HelpCircle className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div className="flex-1">
                  <p className="flex items-center gap-1.5 text-sm text-zinc-900 dark:text-zinc-100">
                    {question.content}
                    {question.is_anonymous && (
                      <span title="Posted anonymously">
                        <Lock className="h-3 w-3 text-zinc-400" />
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {new Date(question.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
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

      {activeTab === 'comments' && (
        <div className="space-y-2">
          {comments.length === 0 ? (
            <p className="py-8 text-center text-zinc-500">No comments yet.</p>
          ) : (
            comments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))
          )}

          {/* Load More Button */}
          {commentsHasMore && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={loadMoreComments}
                disabled={commentsLoading}
                className="gap-2"
              >
                {commentsLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Load More
                    <span className="text-xs text-zinc-500">
                      ({pagination.comments.total - comments.length} remaining)
                    </span>
                  </>
                )}
              </Button>
            </div>
          )}
          {!commentsHasMore && comments.length > 0 && (
            <p className="mt-4 text-center text-sm text-zinc-400">
              You&apos;ve reached the end
            </p>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="py-8 text-center text-zinc-500">No vote changes yet.</p>
          ) : (
            history.map((item) => <HistoryItemComponent key={item.id} item={item} />)
          )}

          {/* Load More Button */}
          {historyHasMore && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={loadMoreHistory}
                disabled={historyLoading}
                className="gap-2"
              >
                {historyLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Load More
                    <span className="text-xs text-zinc-500">
                      ({pagination.history.total - history.length} remaining)
                    </span>
                  </>
                )}
              </Button>
            </div>
          )}
          {!historyHasMore && history.length > 0 && (
            <p className="mt-4 text-center text-sm text-zinc-400">
              You&apos;ve reached the end
            </p>
          )}
        </div>
      )}

      {activeTab === 'comparison' && (
        <div className="space-y-6">
          <CommonGroundCard 
            items={commonGround || []} 
            icon={Heart} 
          />
          
          <DivergenceCard 
            items={divergence || []} 
            icon={Swords}
            labelB="They"
          />
          
          <AskThemAboutCard 
            items={askThemAbout || []} 
            icon={Lightbulb}
          />
          
          <ShareYourTakeCard 
            items={shareYourTake || []} 
            icon={MessageSquareShare}
          />

          {/* Empty state when no comparison data at all */}
          {(!commonGround || commonGround.length === 0) && 
           (!divergence || divergence.length === 0) && 
           (!askThemAbout || askThemAbout.length === 0) && 
           (!shareYourTake || shareYourTake.length === 0) && (
            <p className="py-8 text-center text-zinc-500">No comparison data yet. Vote on more questions to see how you compare!</p>
          )}
        </div>
      )}

      {activeTab === 'rankings' && (
        <AgreementRankings 
          profileUserId={profile.id} 
          profileUsername={profile.username}
        />
      )}
    </div>
  );
}

function StanceItem({ response }: { response: ResponseWithQuestion }) {
  if (!response.question) return null;

  const config = voteConfig[response.vote];
  const Icon = config.icon;

  return (
    <Link
      href={`/question/${response.question.id}`}
      className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
    >
      <div className={cn('rounded-full p-2', config.bg)}>
        <Icon className={cn('h-4 w-4', config.color)} />
      </div>
      <p className="flex-1 text-sm text-zinc-900 dark:text-zinc-100">
        {response.question.content}
      </p>
    </Link>
  );
}

function HistoryItemComponent({ item }: { item: HistoryItem }) {
  // Skip if missing required data or if vote types are invalid
  if (!item.question || !item.previous_vote || !item.new_vote) return null;
  
  const prevConfig = voteConfig[item.previous_vote];
  const newConfig = voteConfig[item.new_vote];
  
  // Skip if vote types don't exist in config (safety check)
  if (!prevConfig || !newConfig) return null;

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
          <span>
            <span className={prevConfig.color}>
              {prevConfig.label}
            </span>
            {' → '}
            <span className={newConfig.color}>
              {newConfig.label}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function CommentItem({ comment }: { comment: CommentWithQuestion }) {
  if (!comment.question) return null;

  const date = new Date(comment.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Render comment content with mentions and GIFs
  const renderCommentContent = (content: string) => {
    // Match @[username](id), @username, and [gif:url] formats
    const combinedRegex = /@\[([^\]]+)\]\(([^)]+)\)|@(\w+)|\[gif:(https?:\/\/[^\]]+)\]/g;
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    let match;
    
    while ((match = combinedRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{content.substring(lastIndex, match.index)}</span>);
      }
      
      if (match[1] && match[2]) {
        // @[username](id) format
        const username = match[1];
        const userId = match[2];
        parts.push(
          <Link
            key={`${match.index}-${userId}`}
            href={`/profile/${userId}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-800/60"
          >
            @{username}
          </Link>
        );
      } else if (match[3]) {
        // Simple @username format
        const username = match[3];
        if (username.toLowerCase() === 'ai') {
          parts.push(
            <Link
              key={`${match.index}-ai`}
              href="/profile/ai"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-100 to-indigo-100 py-0.5 pl-0.5 pr-1.5 text-xs font-medium text-violet-700 hover:opacity-80 dark:from-violet-900/40 dark:to-indigo-900/40 dark:text-violet-300"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500">
                <Bot className="h-2.5 w-2.5 text-white" />
              </span>
              <span>AI</span>
            </Link>
          );
        } else {
          parts.push(
            <span
              key={`${match.index}-${username}`}
              className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
            >
              @{username}
            </span>
          );
        }
      } else if (match[4]) {
        // GIF format [gif:url]
        const gifUrl = match[4];
        parts.push(
          <img
            key={`gif-${match.index}`}
            src={gifUrl}
            alt="GIF"
            className="mt-2 max-w-full rounded-lg"
            style={{ maxHeight: '120px' }}
          />
        );
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < content.length) {
      parts.push(<span key={`text-${lastIndex}`}>{content.substring(lastIndex)}</span>);
    }
    
    return parts.length > 0 ? <>{parts}</> : content;
  };

  const handleCardClick = () => {
    window.location.href = `/question/${comment.question!.id}`;
  };

  return (
    <div
      onClick={handleCardClick}
      className="block cursor-pointer rounded-lg border border-zinc-200 bg-white p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
          <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-zinc-900 dark:text-zinc-100">
            {renderCommentContent(comment.content)}
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            <span>{date}</span>
          </div>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            {comment.question.content}
          </p>
        </div>
      </div>
    </div>
  );
}
