'use client';

import React, { useState, useTransition, useMemo, useEffect, useCallback } from 'react';
import { Check, HelpCircle, X, MessageCircle, Clock, ChevronDown, ChevronUp, Pencil, Lock, Unlock, Vote, MoreHorizontal, Trash2, Share2, Bot, User, Users } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { ProgressBar } from '@/components/ui/progress-bar';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';
import { QuestionWithStats, VoteType, Voter, Comment } from '@/lib/types';
import { cn, getModelDisplayInfo } from '@/lib/utils';
import Link from 'next/link';
import Image from 'next/image';
import { triggerInstallPrompt } from '@/components/install-prompt';
import { VoterList } from '@/components/voter-list';
import { useToast } from '@/components/ui/toast';
import { CommentInput } from '@/components/comment-input';
import { ShareChallenge } from '@/components/share-challenge';

interface QuestionCardProps {
  question: QuestionWithStats;
  authorName?: string;
  authorAvatar?: string | null;
  onVote?: (questionId: string, vote: VoteType) => void;
}

export function QuestionCard({
  question,
  authorName,
  authorAvatar,
  onVote,
}: QuestionCardProps) {
  const { user, refreshProfile, signInWithGoogle } = useAuth();
  const { showToast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [isPending, startTransition] = useTransition();
  const [showVoters, setShowVoters] = useState(false);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [anonymousCounts, setAnonymousCounts] = useState<{ YES: number; NO: number; UNSURE: number }>({ YES: 0, NO: 0, UNSURE: 0 });
  const [loadingVoters, setLoadingVoters] = useState(false);
  
  // Comments state
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  
  // Vote animation state
  const [animatingVote, setAnimatingVote] = useState<VoteType | null>(null);
  const [confettiParticles, setConfettiParticles] = useState<Array<{ id: number; x: number; y: number; color: string }>>([]);
  
  // AI vote insight state
  const [aiVote, setAiVote] = useState<{ vote: VoteType; reasoning: string | null; ai_model?: string | null } | null>(null);
  const [loadingAiVote, setLoadingAiVote] = useState(false);
  
  // Spawn confetti particles
  const spawnConfetti = useCallback((voteType: VoteType) => {
    const colors = {
      YES: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
      NO: ['#f43f5e', '#fb7185', '#fda4af', '#fecdd3'],
      UNSURE: ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a'],
    };
    
    const particles = Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.5;
      const distance = 30 + Math.random() * 40;
      return {
        id: Date.now() + i,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance - 20, // Bias upward
        color: colors[voteType][Math.floor(Math.random() * colors[voteType].length)],
      };
    });
    
    setConfettiParticles(particles);
    
    // Clear particles after animation
    setTimeout(() => setConfettiParticles([]), 600);
  }, []);
  
  // Trigger haptic feedback
  const triggerHaptic = useCallback(() => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
  }, []);
  // Question editing state
  const [isEditingQuestion, setIsEditingQuestion] = useState(false);
  const [editedQuestionContent, setEditedQuestionContent] = useState(question.content);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [deletingQuestion, setDeletingQuestion] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localQuestionContent, setLocalQuestionContent] = useState(question.content);
  const [questionWasEdited, setQuestionWasEdited] = useState(
    question.updated_at && new Date(question.updated_at).getTime() > new Date(question.created_at).getTime() + 1000
  );
  
  // Comment editing state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editedCommentContent, setEditedCommentContent] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  
  // Private voting mode
  const [isPrivateMode, setIsPrivateMode] = useState(false);

  // Share challenge modal state
  const [showShareChallenge, setShowShareChallenge] = useState(false);

  // Fetch AI vote for this question
  const fetchAiVote = useCallback(async () => {
    if (aiVote || loadingAiVote) return; // Already fetched or loading
    
    setLoadingAiVote(true);
    try {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/responses?select=vote,ai_reasoning,ai_model&question_id=eq.${question.id}&is_ai=eq.true&limit=1`;
      const res = await fetch(url, {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      });
      const data = await res.json();
      
      if (Array.isArray(data) && data.length > 0) {
        setAiVote({
          vote: data[0].vote as VoteType,
          reasoning: data[0].ai_reasoning,
          ai_model: data[0].ai_model,
        });
      }
    } catch (err) {
      console.error('Error fetching AI vote:', err);
    } finally {
      setLoadingAiVote(false);
    }
  }, [question.id, aiVote, loadingAiVote]);

  const fetchVoters = async () => {
    // Toggle immediately for animation
    if (showVoters) {
      setShowVoters(false);
      return;
    }
    
    // Show section immediately, then load data
    setShowVoters(true);
    
    // If already fetched, no need to reload
    if (voters.length > 0 || anonymousCounts.YES > 0 || anonymousCounts.NO > 0 || anonymousCounts.UNSURE > 0) {
      return;
    }
    
    setLoadingVoters(true);
    try {
      // Fetch all votes (including anonymous and AI)
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/responses?select=vote,user_id,is_anonymous,is_ai,ai_reasoning&question_id=eq.${question.id}`;
      const res = await fetch(url, {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      });
      const data = await res.json();
      
      // Handle API errors (e.g., missing columns)
      if (!Array.isArray(data)) {
        console.error('Error fetching voters:', data);
        setLoadingVoters(false);
        return;
      }
      
      const responses: { user_id: string; vote: string; is_anonymous: boolean; is_ai?: boolean; ai_reasoning?: string | null }[] = data;
      
      // Separate AI, public, and anonymous votes
      const aiVotes = responses.filter(r => r.is_ai);
      const publicVotes = responses.filter(r => !r.is_anonymous && !r.is_ai);
      const anonymousVotes = responses.filter(r => r.is_anonymous && !r.is_ai);
      
      // Count anonymous votes per type
      const anonCounts = { YES: 0, NO: 0, UNSURE: 0 };
      anonymousVotes.forEach(r => {
        if (r.vote === 'YES' || r.vote === 'NO' || r.vote === 'UNSURE') {
          anonCounts[r.vote]++;
        }
      });
      setAnonymousCounts(anonCounts);
      
      // Create AI voter entries (they go first)
      const aiVotersList: Voter[] = aiVotes.map(r => ({
        id: 'ai',
        username: 'AI',
        avatar_url: null,
        vote: r.vote as VoteType,
        is_ai: true,
        ai_reasoning: r.ai_reasoning,
      }));
      
      // Fetch profiles for public voters only
      let humanVotersList: Voter[] = [];
      if (publicVotes.length > 0) {
        const userIds = publicVotes.map(r => r.user_id);
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
        
        humanVotersList = publicVotes.map(r => ({
          id: r.user_id,
          username: profileMap[r.user_id]?.username || 'Anonymous',
          avatar_url: profileMap[r.user_id]?.avatar_url || null,
          vote: r.vote as VoteType,
          is_ai: false,
        }));
      }
      
      // AI voters go first, then human voters
      setVoters([...aiVotersList, ...humanVotersList]);
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

  const fetchComments = async () => {
    // Toggle immediately for animation
    if (showComments) {
      setShowComments(false);
      return;
    }
    
    // Show section immediately, then load data
    setShowComments(true);
    
    // If already fetched, no need to reload
    if (comments.length > 0) {
      return;
    }
    
    setLoadingComments(true);
    try {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/comments?select=id,user_id,content,created_at,updated_at,is_ai&question_id=eq.${question.id}&order=created_at.asc`;
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
        
        const commentsList: Comment[] = commentsData.map((c: { id: string; user_id: string; content: string; created_at: string; updated_at: string; is_ai?: boolean }) => ({
          id: c.id,
          user_id: c.user_id,
          content: c.content,
          created_at: c.created_at,
          updated_at: c.updated_at,
          username: profileMap[c.user_id]?.username || 'Anonymous',
          avatar_url: profileMap[c.user_id]?.avatar_url || null,
          is_ai: c.is_ai || false,
        }));
        
        setComments(commentsList);
      }
      setShowComments(true);
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
    setLoadingComments(false);
  };

  // Save edited question
  const saveQuestionEdit = async () => {
    if (!user || user.id !== question.author_id) return;
    if (!editedQuestionContent.trim() || editedQuestionContent === localQuestionContent) {
      setIsEditingQuestion(false);
      return;
    }
    
    setSavingQuestion(true);
    try {
      const { error } = await supabase
        .from('questions')
        .update({
          content: editedQuestionContent.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', question.id);
      
      if (!error) {
        setLocalQuestionContent(editedQuestionContent.trim());
        setQuestionWasEdited(true);
        setIsEditingQuestion(false);
      }
    } catch (err) {
      console.error('Error updating question:', err);
    }
    setSavingQuestion(false);
  };

  // Delete question
  const deleteQuestion = async () => {
    if (!user || user.id !== question.author_id) return;
    if (!confirm('Are you sure you want to delete this question? This cannot be undone.')) return;
    
    setDeletingQuestion(true);
    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', question.id);
      
      if (!error) {
        // Trigger a refresh by calling onVote with a special indicator or just reload
        window.location.reload();
      }
    } catch (err) {
      console.error('Error deleting question:', err);
    }
    setDeletingQuestion(false);
  };

  // Share question
  const shareQuestion = async () => {
    const url = `${window.location.origin}/question/${question.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  };

  // Save edited comment
  const saveCommentEdit = async (commentId: string) => {
    if (!user) return;
    if (!editedCommentContent.trim()) {
      setEditingCommentId(null);
      return;
    }
    
    setSavingComment(true);
    try {
      const { error } = await supabase
        .from('comments')
        .update({
          content: editedCommentContent.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', commentId);
      
      if (!error) {
        setComments(prev => prev.map(c => 
          c.id === commentId 
            ? { ...c, content: editedCommentContent.trim(), updated_at: new Date().toISOString() }
            : c
        ));
        setEditingCommentId(null);
      }
    } catch (err) {
      console.error('Error updating comment:', err);
    }
    setSavingComment(false);
  };

  // Delete comment
  const deleteComment = async (commentId: string, commentUserId: string) => {
    if (!user || user.id !== commentUserId) return;
    if (!confirm('Are you sure you want to delete this comment?')) return;
    
    setDeletingCommentId(commentId);
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);
      
      if (!error) {
        setComments(prev => prev.filter(c => c.id !== commentId));
        setCommentCount(prev => prev - 1);
      }
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
    setDeletingCommentId(null);
  };

  // Start editing a comment - convert @[username](id) format to @username for display
  const startEditingComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    // Convert @[username](id) to @username for readable editing
    const readableContent = comment.content.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
    setEditedCommentContent(readableContent);
  };

  // Render comment content with clickable @mentions
  // Supports both @[username](id) format and plain @username format
  const renderCommentContent = (content: string) => {
    // Match @[username](id), @username, and [gif:url] formats
    const combinedRegex = /@\[([^\]]+)\]\(([^)]+)\)|@(\w+)|\[gif:(https?:\/\/[^\]]+)\]/g;
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    let match;
    
    while ((match = combinedRegex.exec(content)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        const textBefore = content.substring(lastIndex, match.index);
        if (textBefore) {
          parts.push(<span key={`text-${lastIndex}`}>{textBefore}</span>);
        }
      }
      
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
        // Simple @username format - check if it's AI
        const username = match[3];
        if (username.toLowerCase() === 'ai') {
          // Render AI mention with avatar
          parts.push(
            <Link
              key={`${match.index}-ai`}
              href="/profile/ai"
              className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-100 to-indigo-100 py-0.5 pl-0.5 pr-1.5 text-xs font-medium text-violet-700 hover:opacity-80 dark:from-violet-900/40 dark:to-indigo-900/40 dark:text-violet-300"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500">
                <Bot className="h-2.5 w-2.5 text-white" />
              </span>
              <span>AI</span>
            </Link>
          );
        } else {
          // Regular username - show as styled text (no link without ID)
          parts.push(
            <span
              key={`${match.index}-${username}`}
              className="font-medium text-blue-600 dark:text-blue-400"
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
            style={{ maxHeight: '200px' }}
          />
        );
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < content.length) {
      const remaining = content.substring(lastIndex);
      if (remaining) {
        parts.push(<span key={`text-${lastIndex}`}>{remaining}</span>);
      }
    }
    
    return parts.length > 0 ? <>{parts}</> : content;
  };
  
  // Local state for vote (persists after voting without refetch)
  const [localUserVote, setLocalUserVote] = useState<VoteType | null>(question.user_vote ?? null);
  const [localVoteIsAnonymous, setLocalVoteIsAnonymous] = useState(question.user_vote_is_anonymous ?? false);
  const [localStats, setLocalStats] = useState(question.stats);
  const [hasVotedLocally, setHasVotedLocally] = useState(false);

  // Sync with prop when it changes (e.g., on initial load)
  // But don't override if user just voted locally
  useEffect(() => {
    if (!hasVotedLocally && question.user_vote !== undefined) {
      setLocalUserVote(question.user_vote);
      setLocalVoteIsAnonymous(question.user_vote_is_anonymous ?? false);
    }
  }, [question.user_vote, question.user_vote_is_anonymous, hasVotedLocally]);

  useEffect(() => {
    if (!hasVotedLocally) {
      setLocalStats(question.stats);
    }
  }, [question.stats, hasVotedLocally]);

  const updateVoteState = (newVote: VoteType | null) => {
    const oldVote = localUserVote;
    const newStats = { ...localStats };

      // Remove old vote count
      if (oldVote) {
      if (oldVote === 'YES') { newStats.yes_count--; newStats.total_votes--; }
      else if (oldVote === 'NO') { newStats.no_count--; newStats.total_votes--; }
      else if (oldVote === 'UNSURE') { newStats.unsure_count--; newStats.total_votes--; }
      }

      // Add new vote count
      if (newVote) {
      if (newVote === 'YES') { newStats.yes_count++; newStats.total_votes++; }
      else if (newVote === 'NO') { newStats.no_count++; newStats.total_votes++; }
      else if (newVote === 'UNSURE') { newStats.unsure_count++; newStats.total_votes++; }
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
    if (!user) {
      signInWithGoogle();
      return;
    }
    
    // Check if poll is expired
    if (isExpired) {
      showToast('This poll has closed', 'error');
      return;
    }

    // Check if user is clicking the same vote to unvote
    const isUnvoting = localUserVote === vote;
    
    // Check if this is the user's first vote on this question
    const isFirstVote = !localUserVote;

    // Trigger animations and haptic feedback (only for new votes, not unvotes)
    if (!isUnvoting) {
      triggerHaptic();
      setAnimatingVote(vote);
      spawnConfetti(vote);
      setTimeout(() => setAnimatingVote(null), 400);
    }

    // Update local state immediately
    if (isUnvoting) {
      updateVoteState(null);
      setLocalVoteIsAnonymous(false);
    } else {
      setHasVotedLocally(true);
      setLocalVoteIsAnonymous(isPrivateMode);
      updateVoteState(vote);
    }

    startTransition(async () => {
      if (isUnvoting) {
        // Delete the vote
        const { error } = await supabase
          .from('responses')
          .delete()
          .eq('user_id', user.id)
          .eq('question_id', question.id);

        if (error) {
          console.error('Error removing vote:', error);
          // Revert on error
          updateVoteState(vote);
          return;
        }
      } else {
        // Perform the actual update/insert (explicitly mark as non-AI vote)
      const { error } = await supabase
        .from('responses')
        .upsert(
          {
            user_id: user.id,
            question_id: question.id,
            vote,
              is_anonymous: isPrivateMode,
              is_ai: false,
            updated_at: new Date().toISOString(),
          },
          {
              onConflict: 'user_id,question_id,is_ai',
          }
        );

      if (error) {
        console.error('Error voting:', error);
        // Revert on error - would need proper error handling in production
          return;
        }
        
        // Reset private mode after voting
        if (isPrivateMode) {
          setIsPrivateMode(false);
        }
        
        // Clear cached voters so next expansion refetches with new vote
        setVoters([]);
        setAnonymousCounts({ YES: 0, NO: 0, UNSURE: 0 });

        // Trigger install prompt on first vote
        if (isFirstVote) {
          triggerInstallPrompt();
        }

        // Notify question author (only on first vote, not vote changes)
        // Don't notify yourself, don't notify for anonymous votes, skip AI questions
        if (isFirstVote && question.author_id && question.author_id !== user.id && !isPrivateMode) {
          supabase.from('notifications').insert({
            user_id: question.author_id,
            type: 'vote',
            actor_id: user.id,
            question_id: question.id,
          }).then(({ error: notifError }) => {
            if (notifError) console.error('Error creating vote notification:', notifError);
          });
        }

        // Notify followers about the vote (only on first vote)
        if (isFirstVote) {
          supabase
            .from('follows')
            .select('follower_id')
            .eq('following_id', user.id)
            .then(({ data: followers }) => {
              if (followers && followers.length > 0) {
                const notifications = followers
                  .filter(f => f.follower_id !== question.author_id) // Don't double-notify author
                  .map(f => ({
                    user_id: f.follower_id,
                    type: 'vote' as const,
                    actor_id: user.id,
                    question_id: question.id,
                  }));
                
                if (notifications.length > 0) {
                  supabase.from('notifications').insert(notifications);
                }
              }
            });
      }

      // Refresh profile to update streak indicator immediately
      refreshProfile();

      onVote?.(question.id, vote);
      }
    });
  };

  const hasVoted = !!optimisticData.userVote;
  const isAuthor = user?.id === question.author_id;
  // Expiration logic
  const expiresAt = useMemo(() => 
    question.expires_at ? new Date(question.expires_at) : null,
    [question.expires_at]
  );
  const [now, setNow] = useState(new Date());
  const isExpired = expiresAt ? now >= expiresAt : false;
  const timeUntilExpiry = expiresAt ? expiresAt.getTime() - now.getTime() : null;
  
  // Can see results if: voted, is the author, poll is expired, or not logged in
  const canSeeResults = hasVoted || isAuthor || isExpired;
  const timeAgo = getTimeAgo(new Date(question.created_at));
  
  // Update "now" every minute for countdown
  useEffect(() => {
    if (!expiresAt || isExpired) return;
    
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [expiresAt, isExpired]);
  
  // Format countdown string
  const getCountdownText = () => {
    if (!timeUntilExpiry || timeUntilExpiry <= 0) return null;
    
    const hours = Math.floor(timeUntilExpiry / (1000 * 60 * 60));
    const minutes = Math.floor((timeUntilExpiry % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d left`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    } else {
      return `${minutes}m left`;
    }
  };
  
  // Fetch AI vote when user can see results
  useEffect(() => {
    if (canSeeResults && !aiVote && !loadingAiVote) {
      fetchAiVote();
    }
  }, [canSeeResults, aiVote, loadingAiVote, fetchAiVote]);

  return (
    <Card className="group transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          {question.is_ai ? (
            <Link 
              href="/profile/ai"
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                    AI
                  </span>
                  {question.ai_model && (() => {
                    const modelInfo = getModelDisplayInfo(question.ai_model);
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
                <span className="flex items-center gap-1 text-xs text-zinc-500">
                  <Clock className="h-3 w-3" />
                  {timeAgo}
                </span>
              </div>
            </Link>
          ) : question.is_anonymous ? (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
                <User className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
              </div>
              <div className="flex flex-col">
                <span className="flex items-center gap-1 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Anonymous
                  {user?.id === question.author_id && (
                    <span title="Your anonymous post"><Lock className="h-3 w-3 text-zinc-400" /></span>
                  )}
                </span>
                <span className="flex items-center gap-1 text-xs text-zinc-500">
                  <Clock className="h-3 w-3" />
                  {timeAgo}
                </span>
              </div>
            </div>
          ) : (
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
          )}
          <div className="flex items-center">
            <div className="relative">
              <DropdownMenu
                trigger={<MoreHorizontal className="h-4 w-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer" />}
                align="right"
              >
                <DropdownMenuItem onClick={shareQuestion}>
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </DropdownMenuItem>
                {user?.id === question.author_id && (
                  <>
                    <DropdownMenuItem onClick={() => setIsEditingQuestion(true)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={deleteQuestion}
                      variant="destructive"
                      disabled={deletingQuestion}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deletingQuestion ? 'Deleting...' : 'Delete'}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenu>
              {copied && (
                <div className="absolute right-0 top-6 z-50 animate-in fade-in slide-in-from-top-1 duration-200">
                  <span className="whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
                    Link copied!
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      
      {/* Question Text - above image for context first */}
      <CardContent className="pb-3">
        {isEditingQuestion ? (
          <div className="space-y-2">
            <textarea
              value={editedQuestionContent}
              onChange={(e) => setEditedQuestionContent(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-lg font-medium text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditingQuestion(false);
                  setEditedQuestionContent(localQuestionContent);
                }}
                disabled={savingQuestion}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={saveQuestionEdit}
                disabled={savingQuestion || !editedQuestionContent.trim()}
              >
                {savingQuestion ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="group relative">
            <Link href={`/question/${question.id}`} className="block hover:opacity-80 transition-opacity">
              <p className="text-lg font-medium leading-relaxed text-zinc-900 dark:text-zinc-100">
                {localQuestionContent}
              </p>
            </Link>
            <div className="flex items-center gap-2 mt-1">
              {questionWasEdited && (
                <span className="text-xs text-zinc-400 italic">(edited)</span>
              )}
              {question.source_url && (
                <a
                  href={question.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-xs text-violet-500 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 transition-colors"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Source
                </a>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* NOTE: Question images disabled. Uncomment to re-enable.
      {question.image_url && (
        <div className="relative w-full aspect-video overflow-hidden mx-4 mb-4 rounded-xl" style={{ width: 'calc(100% - 2rem)' }}>
          <Image
            src={question.image_url}
            alt=""
            fill
            className="object-cover rounded-xl"
            sizes="(max-width: 768px) 100vw, 600px"
          />
        </div>
      )}
      */}

      <CardFooter className="flex-col gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        {/* Expiration Badge */}
        {expiresAt && (
          <div className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
            isExpired 
              ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
              : timeUntilExpiry && timeUntilExpiry < 3600000 // Less than 1 hour
                ? "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400"
                : "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400"
          )}>
            <Clock className="h-4 w-4" />
            {isExpired ? (
              <span>🔒 Voting closed · Final results</span>
            ) : (
              <span>⏱ {getCountdownText()}</span>
            )}
          </div>
        )}

        {/* Vote Buttons */}
        <div className="relative grid w-full grid-cols-3 gap-2">
          <Button
            variant={optimisticData.userVote === 'YES' ? 'yes' : 'yes-outline'}
            size="sm"
            onClick={() => handleVote('YES')}
            disabled={isPending || isExpired}
            className={cn(
              'relative flex-1 gap-1.5 overflow-visible',
              optimisticData.userVote === 'YES' && 'ring-2 ring-emerald-500/50',
              isPrivateMode && 'border-dashed',
              animatingVote === 'YES' && 'animate-vote-pop'
            )}
          >
            {(isPrivateMode || (localVoteIsAnonymous && optimisticData.userVote === 'YES')) && <Lock className="h-3 w-3" />}
            <Check className="h-4 w-4" />
            Yes
            {/* Confetti particles for YES */}
            {animatingVote === 'YES' && confettiParticles.map((particle) => (
              <span
                key={particle.id}
                className="confetti-particle"
                style={{
                  left: '50%',
                  top: '50%',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: particle.color,
                  '--confetti-x': `${particle.x}px`,
                  '--confetti-y': `${particle.y}px`,
                } as React.CSSProperties}
              />
            ))}
          </Button>
          <Button
            variant={optimisticData.userVote === 'NO' ? 'no' : 'no-outline'}
            size="sm"
            onClick={() => handleVote('NO')}
            disabled={isPending || isExpired}
            className={cn(
              'relative flex-1 gap-1.5 overflow-visible',
              optimisticData.userVote === 'NO' && 'ring-2 ring-rose-500/50',
              isPrivateMode && 'border-dashed',
              animatingVote === 'NO' && 'animate-vote-pop'
            )}
          >
            {(isPrivateMode || (localVoteIsAnonymous && optimisticData.userVote === 'NO')) && <Lock className="h-3 w-3" />}
            <X className="h-4 w-4" />
            No
            {/* Confetti particles for NO */}
            {animatingVote === 'NO' && confettiParticles.map((particle) => (
              <span
                key={particle.id}
                className="confetti-particle"
                style={{
                  left: '50%',
                  top: '50%',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: particle.color,
                  '--confetti-x': `${particle.x}px`,
                  '--confetti-y': `${particle.y}px`,
                } as React.CSSProperties}
              />
            ))}
          </Button>
          <Button
            variant={optimisticData.userVote === 'UNSURE' ? 'unsure' : 'unsure-outline'}
            size="sm"
            onClick={() => handleVote('UNSURE')}
            disabled={isPending || isExpired}
            className={cn(
              'relative flex-1 gap-1.5 overflow-visible',
              optimisticData.userVote === 'UNSURE' && 'ring-2 ring-amber-500/50',
              isPrivateMode && 'border-dashed',
              animatingVote === 'UNSURE' && 'animate-vote-pop'
            )}
          >
            {(isPrivateMode || (localVoteIsAnonymous && optimisticData.userVote === 'UNSURE')) && <Lock className="h-3 w-3" />}
            <HelpCircle className="h-4 w-4" />
            Not Sure
            {/* Confetti particles for UNSURE */}
            {animatingVote === 'UNSURE' && confettiParticles.map((particle) => (
              <span
                key={particle.id}
                className="confetti-particle"
                style={{
                  left: '50%',
                  top: '50%',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: particle.color,
                  '--confetti-x': `${particle.x}px`,
                  '--confetti-y': `${particle.y}px`,
                } as React.CSSProperties}
              />
            ))}
          </Button>
        </div>

        {/* Results - Show after voting or if author */}
        {optimisticData.stats.total_votes > 0 && (
          <div className="w-full animate-in fade-in slide-in-from-top-2 duration-300">
            {canSeeResults ? (
              <ProgressBar
                yes={optimisticData.stats.yes_count}
                no={optimisticData.stats.no_count}
                unsure={optimisticData.stats.unsure_count}
                size="md"
              />
            ) : (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  signInWithGoogle();
                }}
                className="relative h-8 w-full overflow-hidden rounded-lg bg-gradient-to-r from-zinc-200 via-zinc-100 to-zinc-200 dark:from-zinc-700 dark:via-zinc-600 dark:to-zinc-700 cursor-pointer hover:from-zinc-300 hover:via-zinc-200 hover:to-zinc-300 dark:hover:from-zinc-600 dark:hover:via-zinc-500 dark:hover:to-zinc-600 transition-colors"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/20 animate-shimmer" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Vote to see results</span>
                </div>
              </button>
            )}
          </div>
        )}

        {/* AI Insight - Show after voting or if author */}
        {canSeeResults && aiVote && (
          <Link href="/profile/ai" className="block w-full animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-2 rounded-lg bg-gradient-to-r from-violet-50 to-indigo-50 p-3 transition-colors hover:from-violet-100 hover:to-indigo-100 dark:from-violet-950/30 dark:to-indigo-950/30 dark:hover:from-violet-950/50 dark:hover:to-indigo-950/50">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500">
                <Bot className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                    AI voted {aiVote.vote === 'YES' ? 'Yes' : aiVote.vote === 'NO' ? 'No' : 'Not Sure'}
                  </span>
                  {aiVote.ai_model && (() => {
                    const modelInfo = getModelDisplayInfo(aiVote.ai_model);
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
                {aiVote.reasoning && (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    &ldquo;{aiVote.reasoning}&rdquo;
                  </p>
                )}
              </div>
            </div>
          </Link>
        )}

        {/* Challenge a Friend - Show after voting */}
        {hasVoted && user && optimisticData.userVote && (
          <button
            onClick={() => setShowShareChallenge(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-3 text-sm font-medium text-zinc-600 transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:border-violet-600 dark:hover:bg-violet-950/30 dark:hover:text-violet-300"
          >
            <Users className="h-4 w-4" />
            {isAuthor ? 'Share with friends' : 'Challenge a friend'}
          </button>
        )}

        {/* Stats Row - votes and comments */}
        <div className="flex w-full items-center justify-center gap-6 pt-2">
          <button
            onClick={() => {
              if (!canSeeResults && optimisticData.stats.total_votes > 0) {
                showToast('Vote first to see who voted!');
                return;
              }
              if (optimisticData.stats.total_votes > 0) {
                fetchVoters();
              }
            }}
            disabled={optimisticData.stats.total_votes === 0}
            className={cn(
              "flex items-center gap-1.5 text-sm text-zinc-500 transition-colors",
              optimisticData.stats.total_votes > 0 && "hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer"
            )}
          >
            <Vote className="h-4 w-4" />
            <span>{optimisticData.stats.total_votes}</span>
            {optimisticData.stats.total_votes > 0 && (
              showVoters ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )
            )}
          </button>
          <button
            onClick={() => {
              if (!canSeeResults) {
                showToast('Vote first to see comments!');
                return;
              }
              fetchComments();
            }}
            className="flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer"
          >
            <MessageCircle className="h-4 w-4" />
            <span>{commentCount}</span>
            {showComments ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
          {/* Anonymous/Public toggle */}
          {user && (
            <button
              type="button"
              onClick={() => setIsPrivateMode(!isPrivateMode)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors",
                isPrivateMode
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              )}
              title={isPrivateMode ? "Voting anonymously" : "Vote anonymously"}
            >
              {isPrivateMode ? (
                <Lock className="h-3 w-3" />
              ) : (
                <Unlock className="h-3 w-3" />
              )}
              {isPrivateMode ? "Anonymous" : "Public"}
            </button>
          )}
        </div>
      </CardFooter>

      {/* Expandable Voters List - at bottom of card */}
      {showVoters && (
        <div className="border-t border-zinc-100 px-6 py-3 dark:border-zinc-800 animate-in fade-in slide-in-from-top-2 duration-300">
          {voters.length > 0 || anonymousCounts.YES > 0 || anonymousCounts.NO > 0 || anonymousCounts.UNSURE > 0 ? (
            <VoterList voters={voters} anonymousCounts={anonymousCounts} />
          ) : !loadingVoters ? (
            <p className="text-sm text-zinc-500 text-center py-2">No votes yet</p>
          ) : null}
        </div>
      )}

      {/* Expandable Comments Section - at bottom of card */}
      {showComments && (
        <div className="border-t border-zinc-100 px-6 py-3 dark:border-zinc-800 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="space-y-3">
            {comments.length === 0 && !loadingComments ? (
              <p className="text-sm text-zinc-500">No comments yet. Be the first to comment!</p>
            ) : comments.length > 0 ? (
              comments.map(comment => {
                const isAIComment = (comment as { is_ai?: boolean }).is_ai === true;
                const isThinking = (comment as { isThinking?: boolean }).isThinking;
                const isError = (comment as { isError?: boolean }).isError;
                
                return (
                <div key={comment.id} className={cn(
                  "group flex gap-3",
                  isAIComment && "rounded-lg bg-gradient-to-r from-violet-50 to-indigo-50 p-3 dark:from-violet-950/30 dark:to-indigo-950/30"
                )}>
                  {isAIComment ? (
                    <Link href="/profile/ai">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 transition-opacity hover:opacity-80">
                        <Bot className={cn("h-4 w-4 text-white", isThinking && "animate-pulse")} />
                      </div>
                    </Link>
                  ) : (
                    <Link href={`/profile/${comment.user_id}`}>
                      <Avatar src={comment.avatar_url} fallback={comment.username || ''} size="sm" className="h-8 w-8 flex-shrink-0" />
                    </Link>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isAIComment ? (
                        <Link href="/profile/ai" className="text-sm font-medium bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent hover:opacity-80">
                          AI
                        </Link>
                      ) : (
                        <Link href={`/profile/${comment.user_id}`} className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                          {comment.username}
                        </Link>
                      )}
                      {!isThinking && (
                        <span className="text-xs text-zinc-500">
                          {getTimeAgo(new Date(comment.created_at))}
                        </span>
                      )}
                      {isThinking && (
                        <span className="text-xs text-violet-500 animate-pulse">thinking...</span>
                      )}
                      {isError && (
                        <span className="text-xs text-rose-500">error</span>
                      )}
                      {comment.updated_at && new Date(comment.updated_at).getTime() > new Date(comment.created_at).getTime() + 1000 && (
                        <span className="text-xs text-zinc-400 italic">(edited)</span>
                      )}
                      {user?.id === comment.user_id && !isAIComment && editingCommentId !== comment.id && (
                        <DropdownMenu
                          trigger={<MoreHorizontal className="h-3.5 w-3.5 text-zinc-400" />}
                          align="right"
                        >
                          <DropdownMenuItem onClick={() => startEditingComment(comment)}>
                            <Pencil className="h-3 w-3" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => deleteComment(comment.id, comment.user_id)}
                            variant="destructive"
                            disabled={deletingCommentId === comment.id}
                          >
                            <Trash2 className="h-3 w-3" />
                            {deletingCommentId === comment.id ? 'Deleting...' : 'Delete'}
                          </DropdownMenuItem>
                        </DropdownMenu>
                      )}
                    </div>
                    {editingCommentId === comment.id ? (
                      <div className="mt-1 space-y-2">
                        <input
                          type="text"
                          value={editedCommentContent}
                          onChange={(e) => setEditedCommentContent(e.target.value)}
                          className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveCommentEdit(comment.id);
                            if (e.key === 'Escape') setEditingCommentId(null);
                          }}
                        />
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingCommentId(null)}
                            disabled={savingComment}
                            className="h-7 px-2 text-xs"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => saveCommentEdit(comment.id)}
                            disabled={savingComment || !editedCommentContent.trim()}
                            className="h-7 px-2 text-xs"
                          >
                            {savingComment ? (
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                              'Save'
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className={cn(
                        "text-sm break-words",
                        isAIComment ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-700 dark:text-zinc-300",
                        isThinking && !comment.content && "text-zinc-400 dark:text-zinc-500"
                      )}>
                        {isThinking && !comment.content ? '...' : renderCommentContent(comment.content)}
                      </p>
                    )}
                  </div>
                </div>
              );})
            ) : null}
            
            {/* Comment Form */}
            <CommentInput
              questionId={question.id}
              questionAuthorId={question.author_id}
              onCommentAdded={(comment) => {
                setComments(prev => [...prev, comment]);
                setShowComments(true);
              }}
              onCommentCountChange={(delta) => setCommentCount(prev => prev + delta)}
              onAIThinking={(placeholderId) => {
                setComments(prev => [...prev, {
                  id: placeholderId,
                  user_id: user?.id || '',
                  content: '',
                  created_at: new Date().toISOString(),
                  username: 'AI',
                  avatar_url: null,
                  isThinking: true,
                  is_ai: true,
                }]);
              }}
              onAIStreaming={(placeholderId, content) => {
                setComments(prev => prev.map(c => 
                  c.id === placeholderId 
                    ? { ...c, content, isThinking: true }
                    : c
                ));
              }}
              onAIComplete={(placeholderId, commentData, content) => {
                setComments(prev => prev.map(c => 
                  c.id === placeholderId 
                    ? {
                        ...c,
                        id: commentData.id,
                        content,
                        created_at: commentData.created_at,
                        isThinking: false,
                      }
                    : c
                ));
              }}
              onAIError={(placeholderId, error) => {
                setComments(prev => prev.map(c => 
                  c.id === placeholderId 
                    ? { ...c, content: error, isThinking: false, isError: true }
                    : c
                ));
              }}
            />
          </div>
        </div>
      )}

      {/* Share Challenge Modal */}
      {optimisticData.userVote && (
        <ShareChallenge
          isOpen={showShareChallenge}
          onClose={() => setShowShareChallenge(false)}
          questionId={question.id}
          questionContent={localQuestionContent}
          userVote={optimisticData.userVote}
          isAuthor={isAuthor}
        />
      )}
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


