'use client';

import React, { useState, useTransition, useMemo, useEffect, useRef, useCallback } from 'react';
import { Check, HelpCircle, X, MessageCircle, Clock, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';
import { QuestionWithStats, VoteType } from '@/lib/types';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface QuestionCardProps {
  question: QuestionWithStats;
  authorName?: string;
  authorAvatar?: string | null;
  onVote?: (questionId: string, vote: VoteType) => void;
}

interface Voter {
  id: string;
  username: string | null;
  avatar_url: string | null;
  vote: VoteType;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  username: string | null;
  avatar_url: string | null;
}

interface MentionSuggestion {
  id: string;
  username: string;
  avatar_url: string | null;
}

export function QuestionCard({
  question,
  authorName,
  authorAvatar,
  onVote,
}: QuestionCardProps) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [isPending, startTransition] = useTransition();
  const [showVoters, setShowVoters] = useState(false);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loadingVoters, setLoadingVoters] = useState(false);
  
  // Comments state
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  
  // Mention autocomplete state
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentionedUsers, setMentionedUsers] = useState<MentionSuggestion[]>([]); // Track mentioned users for submission
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchVoters = async () => {
    if (voters.length > 0) {
      // Already fetched, just toggle
      setShowVoters(!showVoters);
      return;
    }
    
    setLoadingVoters(true);
    try {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/responses?select=vote,user_id&question_id=eq.${question.id}`;
      const res = await fetch(url, {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      });
      const responses = await res.json();
      
      if (responses.length > 0) {
        const userIds = responses.map((r: { user_id: string }) => r.user_id);
        const profilesUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=id,username,avatar_url&id=in.(${userIds.join(',')})`;
        const profilesRes = await fetch(profilesUrl, {
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
          },
        });
        const profiles = await profilesRes.json();
        
        const profileMap = Object.fromEntries(
          profiles.map((p: { id: string; username: string | null; avatar_url: string | null }) => [p.id, p])
        );
        
        const votersList: Voter[] = responses.map((r: { user_id: string; vote: string }) => ({
          id: r.user_id,
          username: profileMap[r.user_id]?.username || 'Anonymous',
          avatar_url: profileMap[r.user_id]?.avatar_url || null,
          vote: r.vote as VoteType,
        }));
        
        setVoters(votersList);
      }
      setShowVoters(true);
    } catch (err) {
      console.error('Error fetching voters:', err);
    }
    setLoadingVoters(false);
  };

  // Fetch comment count on mount
  useEffect(() => {
    const fetchCommentCount = async () => {
      try {
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/comments?select=id&question_id=eq.${question.id}`;
        const res = await fetch(url, {
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
            'Prefer': 'count=exact',
          },
        });
        const countHeader = res.headers.get('content-range');
        if (countHeader) {
          const count = parseInt(countHeader.split('/')[1] || '0');
          setCommentCount(count);
        } else {
          const data = await res.json();
          setCommentCount(data?.length || 0);
        }
      } catch (err) {
        console.error('Error fetching comment count:', err);
      }
    };
    fetchCommentCount();
  }, [question.id]);

  // Search users for @mention autocomplete
  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 1) {
      setMentionSuggestions([]);
      setShowMentions(false);
      return;
    }
    
    try {
      // Search by username using ilike for case-insensitive partial match
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=id,username,avatar_url&username=ilike.*${encodeURIComponent(query)}*&limit=5`;
      const res = await fetch(url, {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      });
      const users = await res.json();
      
      const suggestions: MentionSuggestion[] = users
        .filter((u: { username: string | null }) => u.username)
        .map((u: { id: string; username: string; avatar_url: string | null }) => ({
          id: u.id,
          username: u.username,
          avatar_url: u.avatar_url,
        }));
      
      setMentionSuggestions(suggestions);
      setShowMentions(suggestions.length > 0);
      setSelectedMentionIndex(0);
    } catch (err) {
      console.error('Error searching users:', err);
    }
  }, []);

  // Handle comment input change - detect @mentions
  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setCommentText(value);
    
    // Find the @ symbol before cursor
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Check if there's a space after @ (meaning mention is complete)
      if (!textAfterAt.includes(' ')) {
        setMentionQuery(textAfterAt);
        setMentionStartIndex(lastAtIndex);
        searchUsers(textAfterAt);
        return;
      }
    }
    
    // No active mention
    setShowMentions(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
  };

  // Insert selected mention into comment
  // Shows @username in input, but tracks user info for submission
  const insertMention = (selectedUser: MentionSuggestion) => {
    if (mentionStartIndex === -1) return;
    
    const beforeMention = commentText.substring(0, mentionStartIndex);
    const afterMention = commentText.substring(mentionStartIndex + mentionQuery.length + 1);
    // Show clean @username in the input
    const newText = `${beforeMention}@${selectedUser.username} ${afterMention}`;
    
    setCommentText(newText);
    // Track this user for when we submit (to convert to @[username](id) format)
    setMentionedUsers(prev => {
      // Avoid duplicates
      if (prev.some(u => u.id === selectedUser.id)) return prev;
      return [...prev, selectedUser];
    });
    setShowMentions(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
    
    // Focus back on input
    inputRef.current?.focus();
  };

  // Handle keyboard navigation in mention dropdown
  const handleMentionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showMentions) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitComment();
      }
      return;
    }
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev < mentionSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev > 0 ? prev - 1 : mentionSuggestions.length - 1
        );
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (mentionSuggestions[selectedMentionIndex]) {
          insertMention(mentionSuggestions[selectedMentionIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowMentions(false);
        break;
    }
  };

  const fetchComments = async () => {
    // If already showing, just collapse
    if (showComments) {
      setShowComments(false);
      return;
    }
    
    // If already fetched, just show
    if (comments.length > 0) {
      setShowComments(true);
      return;
    }
    
    setLoadingComments(true);
    try {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/comments?select=id,user_id,content,created_at&question_id=eq.${question.id}&order=created_at.asc`;
      const res = await fetch(url, {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      });
      const commentsData = await res.json();
      
      if (commentsData.length > 0) {
        const userIds = [...new Set(commentsData.map((c: { user_id: string }) => c.user_id))];
        const profilesUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=id,username,avatar_url&id=in.(${userIds.join(',')})`;
        const profilesRes = await fetch(profilesUrl, {
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
          },
        });
        const profiles = await profilesRes.json();
        
        const profileMap = Object.fromEntries(
          profiles.map((p: { id: string; username: string | null; avatar_url: string | null }) => [p.id, p])
        );
        
        const commentsList: Comment[] = commentsData.map((c: { id: string; user_id: string; content: string; created_at: string }) => ({
          id: c.id,
          user_id: c.user_id,
          content: c.content,
          created_at: c.created_at,
          username: profileMap[c.user_id]?.username || 'Anonymous',
          avatar_url: profileMap[c.user_id]?.avatar_url || null,
        }));
        
        setComments(commentsList);
      }
      setShowComments(true);
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
    setLoadingComments(false);
  };

  const submitComment = async () => {
    if (!user || !commentText.trim()) return;
    
    setSubmittingComment(true);
    try {
      // Convert @username to @[username](id) format for storage
      let contentToSave = commentText.trim();
      for (const mentionedUser of mentionedUsers) {
        // Replace @username with @[username](id) - use word boundary to avoid partial matches
        const regex = new RegExp(`@${mentionedUser.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$|[.,!?;:])`, 'g');
        contentToSave = contentToSave.replace(regex, `@[${mentionedUser.username}](${mentionedUser.id})`);
      }
      
      // Use Supabase client for authenticated insert
      const { data: newComment, error } = await supabase
        .from('comments')
        .insert({
          question_id: question.id,
          user_id: user.id,
          content: contentToSave,
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error inserting comment:', error);
        setSubmittingComment(false);
        return;
      }
      
      if (newComment) {
        // Create notifications
        const notifications: Array<{
          user_id: string;
          type: 'mention' | 'comment';
          actor_id: string;
          question_id: string;
          comment_id: string;
        }> = [];
        
        // Notify mentioned users
        if (mentionedUsers.length > 0) {
          mentionedUsers
            .filter(u => u.id !== user.id) // Don't notify yourself
            .forEach(mentionedUser => {
              notifications.push({
                user_id: mentionedUser.id,
                type: 'mention',
                actor_id: user.id,
                question_id: question.id,
                comment_id: newComment.id,
              });
            });
        }
        
        // Notify question author (if not the commenter and not already mentioned)
        if (question.author_id !== user.id && !mentionedUsers.some(u => u.id === question.author_id)) {
          notifications.push({
            user_id: question.author_id,
            type: 'comment',
            actor_id: user.id,
            question_id: question.id,
            comment_id: newComment.id,
          });
        }
        
        // Insert all notifications (fire and forget)
        if (notifications.length > 0) {
          supabase.from('notifications').insert(notifications).then(({ error: notifError }) => {
            if (notifError) console.error('Error creating notifications:', notifError);
          });
        }
        
        // Add the new comment to the list
        setComments(prev => [...prev, {
          id: newComment.id,
          user_id: user.id,
          content: newComment.content,
          created_at: newComment.created_at,
          username: user.user_metadata?.name || user.email?.split('@')[0] || 'Anonymous',
          avatar_url: user.user_metadata?.avatar_url || null,
        }]);
        setCommentCount(prev => prev + 1);
        setCommentText('');
        setMentionedUsers([]); // Clear tracked mentions
        setShowComments(true);
      }
    } catch (err) {
      console.error('Error submitting comment:', err);
    }
    setSubmittingComment(false);
  };

  // Render comment content with clickable @mentions
  // Supports both @[username](id) format and plain @username format
  const renderCommentContent = (content: string) => {
    // Match @[username](id) format first, then fall back to simple @username
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)|@(\w+)/g;
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    let match;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      // Add text before the mention
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }
      
      // Check which format matched
      if (match[1] && match[2]) {
        // @[username](id) format - we have the user ID
        const username = match[1];
        const userId = match[2];
        parts.push(
          <Link
            key={`${match.index}-${userId}`}
            href={`/profile/${userId}`}
            className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            onClick={(e) => e.stopPropagation()}
          >
            @{username}
          </Link>
        );
      } else if (match[3]) {
        // Simple @username format - just show as styled text (no link without ID)
        const username = match[3];
        parts.push(
          <span
            key={`${match.index}-${username}`}
            className="font-medium text-blue-600 dark:text-blue-400"
          >
            @{username}
          </span>
        );
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : content;
  };
  
  // Local state for vote (persists after voting without refetch)
  const [localUserVote, setLocalUserVote] = useState<VoteType | null>(question.user_vote ?? null);
  const [localStats, setLocalStats] = useState(question.stats);
  const [hasVotedLocally, setHasVotedLocally] = useState(false);

  // Sync with prop when it changes (e.g., on initial load)
  // But don't override if user just voted locally
  useEffect(() => {
    if (!hasVotedLocally && question.user_vote !== undefined) {
      setLocalUserVote(question.user_vote);
    }
  }, [question.user_vote, hasVotedLocally]);

  useEffect(() => {
    if (!hasVotedLocally) {
      setLocalStats(question.stats);
    }
  }, [question.stats, hasVotedLocally]);

  const updateVoteState = (newVote: VoteType) => {
    const oldVote = localUserVote;
    const newStats = { ...localStats };

    // Remove old vote count
    if (oldVote) {
      if (oldVote === 'YES') newStats.yes_count--;
      else if (oldVote === 'NO') newStats.no_count--;
      else newStats.unsure_count--;
      newStats.total_votes--;
    }

    // Add new vote count
    if (newVote) {
      if (newVote === 'YES') newStats.yes_count++;
      else if (newVote === 'NO') newStats.no_count++;
      else newStats.unsure_count++;
      newStats.total_votes++;
    }

    // Recalculate percentages
    if (newStats.total_votes > 0) {
      newStats.yes_percentage = Math.round((newStats.yes_count / newStats.total_votes) * 100);
      newStats.no_percentage = Math.round((newStats.no_count / newStats.total_votes) * 100);
      newStats.unsure_percentage = 100 - newStats.yes_percentage - newStats.no_percentage;
    } else {
      newStats.yes_percentage = 0;
      newStats.no_percentage = 0;
      newStats.unsure_percentage = 0;
    }

    setLocalUserVote(newVote);
    setLocalStats(newStats);
  };

  // Create optimisticData object for compatibility with existing code
  const optimisticData = {
    userVote: localUserVote,
    stats: localStats,
  };

  const handleVote = async (vote: VoteType) => {
    if (!user) return;

    // Check if this is the user's first vote on this question
    const isFirstVote = !localUserVote;

    // Update local state immediately
    setHasVotedLocally(true);
    updateVoteState(vote);

    startTransition(async () => {

      // Perform the actual update
      const { error } = await supabase
        .from('responses')
        .upsert(
          {
            user_id: user.id,
            question_id: question.id,
            vote,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,question_id',
          }
        );

      if (error) {
        console.error('Error voting:', error);
        // Revert on error - would need proper error handling in production
        return;
      }

      // Notify question author (only on first vote, not vote changes)
      // Don't notify yourself
      if (isFirstVote && question.author_id !== user.id) {
        supabase.from('notifications').insert({
          user_id: question.author_id,
          type: 'vote',
          actor_id: user.id,
          question_id: question.id,
        }).then(({ error: notifError }) => {
          if (notifError) console.error('Error creating vote notification:', notifError);
        });
      }

      onVote?.(question.id, vote);
    });
  };

  const hasVoted = !!optimisticData.userVote;
  const timeAgo = getTimeAgo(new Date(question.created_at));

  return (
    <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <Link 
            href={`/profile/${question.author_id}`}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <Avatar
              src={authorAvatar}
              fallback={authorName || 'Anonymous'}
              size="sm"
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {authorName || 'Anonymous'}
              </span>
              <span className="flex items-center gap-1 text-xs text-zinc-500">
                <Clock className="h-3 w-3" />
                {timeAgo}
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchVoters}
              disabled={optimisticData.stats.total_votes === 0}
              className={cn(
                "flex items-center gap-1.5 text-xs text-zinc-500 transition-colors",
                optimisticData.stats.total_votes > 0 && "hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer"
              )}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>{optimisticData.stats.total_votes} votes</span>
              {optimisticData.stats.total_votes > 0 && (
                loadingVoters ? (
                  <span className="h-3 w-3 animate-spin rounded-full border border-zinc-400 border-t-transparent" />
                ) : showVoters ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )
              )}
            </button>
            <button
              onClick={fetchComments}
              className="flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>{commentCount} comments</span>
              {loadingComments ? (
                <span className="h-3 w-3 animate-spin rounded-full border border-zinc-400 border-t-transparent" />
              ) : showComments ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>
      </CardHeader>

      {/* Expandable Voters List */}
      {showVoters && voters.length > 0 && (
        <div className="border-t border-zinc-100 px-6 py-3 dark:border-zinc-800">
          <div className="space-y-3">
            {/* Yes voters */}
            {voters.filter(v => v.vote === 'YES').length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-emerald-600">Yes</p>
                <div className="flex flex-wrap gap-2">
                  {voters.filter(v => v.vote === 'YES').map(voter => (
                    <Link key={voter.id} href={`/profile/${voter.id}`}>
                      <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 py-1 pl-1 pr-2.5 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40">
                        <Avatar src={voter.avatar_url} fallback={voter.username || ''} size="sm" className="h-5 w-5" />
                        <span className="text-xs text-emerald-700 dark:text-emerald-300">{voter.username}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {/* No voters */}
            {voters.filter(v => v.vote === 'NO').length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-rose-600">No</p>
                <div className="flex flex-wrap gap-2">
                  {voters.filter(v => v.vote === 'NO').map(voter => (
                    <Link key={voter.id} href={`/profile/${voter.id}`}>
                      <div className="flex items-center gap-1.5 rounded-full bg-rose-50 py-1 pl-1 pr-2.5 transition-colors hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40">
                        <Avatar src={voter.avatar_url} fallback={voter.username || ''} size="sm" className="h-5 w-5" />
                        <span className="text-xs text-rose-700 dark:text-rose-300">{voter.username}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {/* Not Sure voters */}
            {voters.filter(v => v.vote === 'UNSURE').length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-amber-600">Not Sure</p>
                <div className="flex flex-wrap gap-2">
                  {voters.filter(v => v.vote === 'UNSURE').map(voter => (
                    <Link key={voter.id} href={`/profile/${voter.id}`}>
                      <div className="flex items-center gap-1.5 rounded-full bg-amber-50 py-1 pl-1 pr-2.5 transition-colors hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40">
                        <Avatar src={voter.avatar_url} fallback={voter.username || ''} size="sm" className="h-5 w-5" />
                        <span className="text-xs text-amber-700 dark:text-amber-300">{voter.username}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expandable Comments Section */}
      {showComments && (
        <div className="border-t border-zinc-100 px-6 py-3 dark:border-zinc-800">
          <div className="space-y-3">
            {comments.length === 0 ? (
              <p className="text-sm text-zinc-500">No comments yet. Be the first to comment!</p>
            ) : (
              comments.map(comment => (
                <div key={comment.id} className="flex gap-3">
                  <Link href={`/profile/${comment.user_id}`}>
                    <Avatar src={comment.avatar_url} fallback={comment.username || ''} size="sm" className="h-8 w-8 flex-shrink-0" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/profile/${comment.user_id}`} className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                        {comment.username}
                      </Link>
                      <span className="text-xs text-zinc-500">
                        {getTimeAgo(new Date(comment.created_at))}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 break-words">
                      {renderCommentContent(comment.content)}
                    </p>
                  </div>
                </div>
              ))
            )}
            
            {/* Comment Form */}
            {user ? (
              <div className="relative pt-2 border-t border-zinc-100 dark:border-zinc-800">
                {/* Mention Suggestions Dropdown */}
                {showMentions && mentionSuggestions.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800 z-50">
                    {mentionSuggestions.map((suggestionUser, index) => (
                      <button
                        key={suggestionUser.id}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700",
                          index === selectedMentionIndex && "bg-zinc-100 dark:bg-zinc-700"
                        )}
                        onClick={() => insertMention(suggestionUser)}
                      >
                        <Avatar
                          src={suggestionUser.avatar_url}
                          fallback={suggestionUser.username}
                          size="sm"
                        />
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {suggestionUser.username}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Tagged Users Chips */}
                {mentionedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {mentionedUsers.map((taggedUser) => (
                      <span
                        key={taggedUser.id}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-100 py-0.5 pl-0.5 pr-2 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                      >
                        <Avatar
                          src={taggedUser.avatar_url}
                          fallback={taggedUser.username}
                          size="xs"
                        />
                        <span>@{taggedUser.username}</span>
                        <button
                          type="button"
                          onClick={() => {
                            // Remove from tracked users
                            setMentionedUsers(prev => prev.filter(u => u.id !== taggedUser.id));
                            // Remove from comment text
                            setCommentText(prev => 
                              prev.replace(new RegExp(`@${taggedUser.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s?`, 'g'), '')
                            );
                          }}
                          className="ml-0.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={commentText}
                    onChange={handleCommentChange}
                    placeholder={mentionedUsers.length > 0 ? "Add your message..." : "Add a comment... (use @ to mention)"}
                    className="h-[38px] flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:placeholder:text-zinc-500"
                    onKeyDown={handleMentionKeyDown}
                  />
                  <Button
                    onClick={submitComment}
                    disabled={!commentText.trim() || submittingComment}
                    className="h-[38px] px-3"
                  >
                    {submittingComment ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                Sign in to comment
              </p>
            )}
          </div>
        </div>
      )}
      
      <CardContent className="pb-4">
        <p className="text-lg font-medium leading-relaxed text-zinc-900 dark:text-zinc-100">
          {question.content}
        </p>
      </CardContent>

      <CardFooter className="flex-col gap-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        {/* Vote Buttons */}
        <div className="grid w-full grid-cols-3 gap-2">
          <Button
            variant={optimisticData.userVote === 'YES' ? 'yes' : 'yes-outline'}
            size="sm"
            onClick={() => handleVote('YES')}
            disabled={isPending || !user}
            className={cn(
              'flex-1 gap-1.5',
              optimisticData.userVote === 'YES' && 'ring-2 ring-emerald-500/50'
            )}
          >
            <Check className="h-4 w-4" />
            Yes
          </Button>
          <Button
            variant={optimisticData.userVote === 'NO' ? 'no' : 'no-outline'}
            size="sm"
            onClick={() => handleVote('NO')}
            disabled={isPending || !user}
            className={cn(
              'flex-1 gap-1.5',
              optimisticData.userVote === 'NO' && 'ring-2 ring-rose-500/50'
            )}
          >
            <X className="h-4 w-4" />
            No
          </Button>
          <Button
            variant={optimisticData.userVote === 'UNSURE' ? 'unsure' : 'unsure-outline'}
            size="sm"
            onClick={() => handleVote('UNSURE')}
            disabled={isPending || !user}
            className={cn(
              'flex-1 gap-1.5',
              optimisticData.userVote === 'UNSURE' && 'ring-2 ring-amber-500/50'
            )}
          >
            <HelpCircle className="h-4 w-4" />
            Not Sure
          </Button>
        </div>

        {/* Results - Show after voting or if has votes */}
        {(hasVoted || optimisticData.stats.total_votes > 0) && (
          <div className="w-full animate-in fade-in slide-in-from-top-2 duration-300">
            <ProgressBar
              yes={optimisticData.stats.yes_count}
              no={optimisticData.stats.no_count}
              unsure={optimisticData.stats.unsure_count}
              size="md"
            />
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}


