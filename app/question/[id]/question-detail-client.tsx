'use client';

import React, { useState, useTransition, useMemo, useRef, useCallback, useEffect } from 'react';
import { ArrowLeft, Check, HelpCircle, X, Send, Clock, ChevronDown, ChevronUp, Pencil, Lock, Unlock, MoreHorizontal, Trash2, Share2, Bot, User } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { ProgressBar } from '@/components/ui/progress-bar';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';
import { QuestionWithStats, VoteType, Comment, MentionSuggestion, Voter, AI_MENTION } from '@/lib/types';
import { cn } from '@/lib/utils';
import { VoterList } from '@/components/voter-list';
import { useToast } from '@/components/ui/toast';

interface QuestionDetailClientProps {
  question: QuestionWithStats;
  initialComments: Comment[];
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function QuestionDetailClient({ question, initialComments }: QuestionDetailClientProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [isPending, startTransition] = useTransition();
  
  // Vote state
  const [localUserVote, setLocalUserVote] = useState<VoteType | null>(question.user_vote ?? null);
  const [localVoteIsAnonymous, setLocalVoteIsAnonymous] = useState(question.user_vote_is_anonymous ?? false);
  const [localStats, setLocalStats] = useState(question.stats);
  
  // Voters state
  const [showVoters, setShowVoters] = useState(false);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [anonymousCounts, setAnonymousCounts] = useState<{ YES: number; NO: number; UNSURE: number }>({ YES: 0, NO: 0, UNSURE: 0 });
  const [loadingVoters, setLoadingVoters] = useState(false);
  
  // Comments state
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  
  // Mention autocomplete state
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentionedUsers, setMentionedUsers] = useState<MentionSuggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const hasVoted = !!localUserVote;
  const isAuthor = user?.id === question.author_id;
  // Can see results if: voted, is the author, or not logged in (guests can't comment anyway)
  const canSeeResults = hasVoted || isAuthor;

  const timeAgo = getTimeAgo(new Date(question.created_at));

  // Vote handling
  const updateVoteState = (newVote: VoteType | null) => {
    const oldVote = localUserVote;
    const newStats = { ...localStats };

    // Remove old vote count (SKIP doesn't affect total_votes for percentage calculation)
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

    // Recalculate percentages (based on non-SKIP votes)
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

  const handleVote = async (vote: VoteType) => {
    if (!user) return;

    // Check if user is clicking the same vote to unvote
    const isUnvoting = localUserVote === vote;
    const isFirstVote = !localUserVote;
    
    // Update local state immediately
    if (isUnvoting) {
      updateVoteState(null);
      setLocalVoteIsAnonymous(false);
    } else {
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
            { onConflict: 'user_id,question_id,is_ai' }
          );

        if (error) {
          console.error('Error voting:', error);
          return;
        }
        
        // Reset private mode after voting
        if (isPrivateMode) {
          setIsPrivateMode(false);
        }
        
        // Clear cached voters so next expansion refetches with new vote
        setVoters([]);
        setAnonymousCounts({ YES: 0, NO: 0, UNSURE: 0 });

        // Notify question author on first vote (not for anonymous votes)
        if (isFirstVote && question.author_id !== user.id && !isPrivateMode) {
          supabase.from('notifications').insert({
            user_id: question.author_id,
            type: 'vote',
            actor_id: user.id,
            question_id: question.id,
          });
        }
      }
    });
  };

  // Fetch voters (exclude anonymous and SKIP votes)
  const fetchVoters = async () => {
    if (voters.length > 0 || anonymousCounts.YES > 0 || anonymousCounts.NO > 0 || anonymousCounts.UNSURE > 0) {
      setShowVoters(!showVoters);
      return;
    }
    
    setLoadingVoters(true);
    try {
      // Fetch all votes (including anonymous and AI)
      const { data: responses, error } = await supabase
        .from('responses')
        .select('vote, user_id, is_anonymous, is_ai, ai_reasoning')
        .eq('question_id', question.id);
      
      if (error) {
        console.error('Error fetching voters:', error);
        setLoadingVoters(false);
        setShowVoters(true);
        return;
      }
      
      if (responses && responses.length > 0) {
        // Separate AI, public, and anonymous votes
        const aiVotes = responses.filter(r => r.is_ai);
        const publicVotes = responses.filter(r => !r.is_anonymous && !r.is_ai);
        const anonymousVotes = responses.filter(r => r.is_anonymous && !r.is_ai);
        
        // Count anonymous votes per type
        const anonCounts = { YES: 0, NO: 0, UNSURE: 0 };
        anonymousVotes.forEach(r => {
          if (r.vote === 'YES' || r.vote === 'NO' || r.vote === 'UNSURE') {
            anonCounts[r.vote as 'YES' | 'NO' | 'UNSURE']++;
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
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', userIds);
          
          const profileMap = Object.fromEntries(
            (profiles || []).map(p => [p.id, p])
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
      }
      setShowVoters(true);
    } catch (err) {
      console.error('Error fetching voters:', err);
    }
    setLoadingVoters(false);
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
        // Navigate back to feed after deletion
        window.location.href = '/';
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

  // Mention search
  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 1) {
      setMentionSuggestions([]);
      setShowMentions(false);
      return;
    }
    
    try {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${query}%`)
        .limit(5);
      
      const suggestions: MentionSuggestion[] = (users || [])
        .filter((u) => u.username)
        .map((u) => ({
          id: u.id,
          username: u.username!,
          avatar_url: u.avatar_url,
        }));
      
      // Add AI to suggestions if query matches
      const queryLower = query.toLowerCase();
      if ('ai'.startsWith(queryLower) || queryLower === 'ai') {
        suggestions.unshift(AI_MENTION);
      }
      
      setMentionSuggestions(suggestions);
      setShowMentions(suggestions.length > 0);
      setSelectedMentionIndex(0);
    } catch (err) {
      console.error('Error searching users:', err);
    }
  }, [supabase]);

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setCommentText(value);
    
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(' ')) {
        setMentionQuery(textAfterAt);
        setMentionStartIndex(lastAtIndex);
        searchUsers(textAfterAt);
        return;
      }
    }
    
    setShowMentions(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
  };

  const insertMention = (selectedUser: MentionSuggestion) => {
    if (mentionStartIndex === -1) return;
    
    const beforeMention = commentText.substring(0, mentionStartIndex);
    const afterMention = commentText.substring(mentionStartIndex + mentionQuery.length + 1);
    const newText = `${beforeMention}${afterMention}`.trim();
    
    setCommentText(newText);
    setMentionedUsers(prev => {
      if (prev.some(u => u.id === selectedUser.id)) return prev;
      return [...prev, selectedUser];
    });
    setShowMentions(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
    inputRef.current?.focus();
  };

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
        setSelectedMentionIndex(prev => prev < mentionSuggestions.length - 1 ? prev + 1 : 0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedMentionIndex(prev => prev > 0 ? prev - 1 : mentionSuggestions.length - 1);
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

  const submitComment = async () => {
    if (!user || (!commentText.trim() && mentionedUsers.length === 0)) return;
    
    setSubmittingComment(true);
    try {
      // For AI mentions, just use @AI (no ID needed)
      const mentionStrings = mentionedUsers.map(u => 
        u.is_ai ? '@AI' : `@[${u.username}](${u.id})`
      );
      const messageText = commentText.trim();
      const contentToSave = mentionStrings.length > 0 
        ? messageText ? `${mentionStrings.join(' ')} ${messageText}` : mentionStrings.join(' ')
        : messageText;
      
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
        // Create notifications (skip AI and self)
        const notifications: Array<{
          user_id: string;
          type: 'mention' | 'comment';
          actor_id: string;
          question_id: string;
          comment_id: string;
        }> = [];
        
        mentionedUsers
          .filter(u => u.id !== user.id && !u.is_ai)
          .forEach(mentionedUser => {
            notifications.push({
              user_id: mentionedUser.id,
              type: 'mention',
              actor_id: user.id,
              question_id: question.id,
              comment_id: newComment.id,
            });
          });
        
        // Notify question author (skip for AI questions which have no author)
        if (question.author_id && question.author_id !== user.id && !mentionedUsers.some(u => u.id === question.author_id)) {
          notifications.push({
            user_id: question.author_id,
            type: 'comment',
            actor_id: user.id,
            question_id: question.id,
            comment_id: newComment.id,
          });
        }
        
        if (notifications.length > 0) {
          supabase.from('notifications').insert(notifications);
        }
        
        setComments(prev => [...prev, {
          id: newComment.id,
          user_id: user.id,
          content: newComment.content,
          created_at: newComment.created_at,
          username: user.user_metadata?.name || user.email?.split('@')[0] || 'Anonymous',
          avatar_url: user.user_metadata?.avatar_url || null,
        }]);
        
        // Clear input immediately after posting (don't wait for AI)
        setCommentText('');
        setMentionedUsers([]);
        setSubmittingComment(false);
        
        // Check if comment mentions @AI
        const hasAIMention = contentToSave.toLowerCase().includes('@ai');
        
        if (hasAIMention) {
          // Show "AI is thinking..." placeholder
          const aiPlaceholderId = `ai-thinking-${Date.now()}`;
          setComments(prev => [...prev, {
            id: aiPlaceholderId,
            user_id: user.id,
            content: '...',
            created_at: new Date().toISOString(),
            username: 'AI',
            avatar_url: null,
            is_ai: true,
          }]);
          
          // Call the AI API
          try {
            const aiResponse = await fetch('/api/ai-comment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                questionId: question.id,
                userQuery: contentToSave,
                userId: user.id,
              }),
            });
            
            if (aiResponse.ok) {
              const { comment: aiComment } = await aiResponse.json();
              // Replace placeholder with actual AI response
              setComments(prev => prev.map(c => 
                c.id === aiPlaceholderId 
                  ? {
                      id: aiComment.id,
                      user_id: user.id,
                      content: aiComment.content,
                      created_at: aiComment.created_at,
                      username: 'AI',
                      avatar_url: null,
                      is_ai: true,
                    }
                  : c
              ));
            } else {
              const errorData = await aiResponse.json();
              // Replace placeholder with error message
              setComments(prev => prev.map(c => 
                c.id === aiPlaceholderId 
                  ? {
                      ...c,
                      content: errorData.error || 'Sorry, I couldn\'t respond right now.',
                    }
                  : c
              ));
            }
          } catch (aiErr) {
            console.error('AI comment error:', aiErr);
            // Remove placeholder on error
            setComments(prev => prev.filter(c => c.id !== aiPlaceholderId));
          }
        }
        
        return;
      }
    } catch (err) {
      console.error('Error submitting comment:', err);
    }
    setSubmittingComment(false);
  };

  // Render comment with clickable mentions
  const renderCommentContent = (content: string) => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)|@(\w+)/g;
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    let match;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }
      
      if (match[1] && match[2]) {
        const username = match[1];
        const oderId = match[2];
        parts.push(
          <Link
            key={`${match.index}-${oderId}`}
            href={`/profile/${oderId}`}
            className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            @{username}
          </Link>
        );
      } else if (match[3]) {
        parts.push(
          <span key={`${match.index}-${match[3]}`} className="font-medium text-blue-600 dark:text-blue-400">
            @{match[3]}
          </span>
        );
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : content;
  };

  // Real-time comments subscription
  useEffect(() => {
    const channel = supabase
      .channel(`comments-${question.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `question_id=eq.${question.id}`,
        },
        async (payload) => {
          const newComment = payload.new as Comment;
          if (!comments.some(c => c.id === newComment.id)) {
            // Fetch profile for new comment
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', newComment.user_id)
              .single();
            
            setComments(prev => [...prev, {
              ...newComment,
              username: profile?.username || 'Anonymous',
              avatar_url: profile?.avatar_url || null,
            }]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [question.id, supabase, comments]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 page-transition-in">
      {/* Back button */}
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
        <ArrowLeft className="h-4 w-4" />
        Back to feed
      </Link>

      {/* Question Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          {/* Author */}
          {question.is_ai ? (
            <Link 
              href="/profile/ai"
              className="mb-4 flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                  AI
                </p>
                <div className="flex items-center gap-1 text-xs text-zinc-500">
                  <Clock className="h-3 w-3" />
                  <span>{timeAgo}</span>
                </div>
              </div>
            </Link>
          ) : question.is_anonymous ? (
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
                <User className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
              </div>
              <div>
                <p className="flex items-center gap-1 font-medium text-zinc-600 dark:text-zinc-400">
                  Anonymous
                  {user?.id === question.author_id && (
                    <span title="Your anonymous post"><Lock className="h-3 w-3 text-zinc-400" /></span>
                  )}
                </p>
                <div className="flex items-center gap-1 text-xs text-zinc-500">
                  <Clock className="h-3 w-3" />
                  <span>{timeAgo}</span>
                </div>
              </div>
            </div>
          ) : (
            <Link 
              href={`/profile/${question.author_id}`}
              className="mb-4 flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <Avatar
                src={question.author?.avatar_url}
                fallback={question.author?.username || 'A'}
                size="md"
              />
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {question.author?.username || 'Anonymous'}
                </p>
                <div className="flex items-center gap-1 text-xs text-zinc-500">
                  <Clock className="h-3 w-3" />
                  <span>{timeAgo}</span>
                </div>
              </div>
            </Link>
          )}

          {/* Question Image */}
          {question.image_url && (
            <div className="relative mb-4 aspect-video w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
              <Image
                src={question.image_url}
                alt=""
                fill
                className="object-cover"
                priority
              />
            </div>
          )}

          {/* Question content */}
          {isEditingQuestion ? (
            <div className="mb-6 space-y-2">
              <textarea
                value={editedQuestionContent}
                onChange={(e) => setEditedQuestionContent(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xl font-medium text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
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
            <div className="group relative mb-6">
              <p className="text-xl font-medium leading-relaxed text-zinc-900 dark:text-zinc-100">
                {localQuestionContent}
              </p>
              <div className="mt-2 flex items-center gap-2">
                {questionWasEdited && (
                  <span className="text-xs text-zinc-400 italic">(edited)</span>
                )}
                {question.category && (
                  <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {question.category}
                  </span>
                )}
              </div>
              <div className="absolute -right-1 -top-1">
                <DropdownMenu
                  trigger={<MoreHorizontal className="h-4 w-4 text-zinc-400" />}
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
                  <div className="absolute right-0 top-8 z-50 animate-in fade-in slide-in-from-top-1 duration-200">
                    <span className="whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
                      Link copied!
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vote stats */}
          {localStats.total_votes > 0 && (
            <div className="mb-4">
              {canSeeResults ? (
                <ProgressBar
                  yes={localStats.yes_count}
                  no={localStats.no_count}
                  unsure={localStats.unsure_count}
                />
              ) : (
                <div className="relative h-10 overflow-hidden rounded-lg bg-gradient-to-r from-zinc-200 via-zinc-100 to-zinc-200 dark:from-zinc-700 dark:via-zinc-600 dark:to-zinc-700">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/20 animate-shimmer" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Vote to see results</span>
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  if (!canSeeResults) {
                    showToast('Vote first to see who voted!');
                    return;
                  }
                  fetchVoters();
                }}
                className="mt-2 flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer"
              >
                <span>{localStats.total_votes} vote{localStats.total_votes !== 1 ? 's' : ''}</span>
                {loadingVoters ? (
                  <span className="h-3 w-3 animate-spin rounded-full border border-zinc-400 border-t-transparent" />
                ) : showVoters ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
              
              {/* Voters List */}
              {showVoters && canSeeResults && (voters.length > 0 || anonymousCounts.YES > 0 || anonymousCounts.NO > 0 || anonymousCounts.UNSURE > 0) && (
                <div className="mt-3">
                  <VoterList voters={voters} anonymousCounts={anonymousCounts} />
                </div>
              )}
            </div>
          )}

          {/* Vote Mode Toggle + Vote Buttons */}
          {user && (
            <div className="mb-3 flex justify-end">
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
            </div>
          )}
          
          {/* Vote buttons */}
          {user && (
            <div className="grid grid-cols-3 gap-3">
              <Button
                variant={localUserVote === 'YES' ? 'default' : 'outline'}
                onClick={() => handleVote('YES')}
                disabled={isPending}
                className={cn(
                  'gap-2',
                  localUserVote === 'YES' && 'bg-emerald-600 hover:bg-emerald-700',
                  isPrivateMode && 'border-dashed'
                )}
              >
                {(isPrivateMode || (localVoteIsAnonymous && localUserVote === 'YES')) && <Lock className="h-3 w-3" />}
                <Check className="h-4 w-4" />
                Yes
              </Button>
              <Button
                variant={localUserVote === 'NO' ? 'default' : 'outline'}
                onClick={() => handleVote('NO')}
                disabled={isPending}
                className={cn(
                  'gap-2',
                  localUserVote === 'NO' && 'bg-rose-600 hover:bg-rose-700',
                  isPrivateMode && 'border-dashed'
                )}
              >
                {(isPrivateMode || (localVoteIsAnonymous && localUserVote === 'NO')) && <Lock className="h-3 w-3" />}
                <X className="h-4 w-4" />
                No
              </Button>
              <Button
                variant={localUserVote === 'UNSURE' ? 'default' : 'outline'}
                onClick={() => handleVote('UNSURE')}
                disabled={isPending}
                className={cn(
                  'gap-2',
                  localUserVote === 'UNSURE' && 'bg-amber-600 hover:bg-amber-700',
                  isPrivateMode && 'border-dashed'
                )}
              >
                {(isPrivateMode || (localVoteIsAnonymous && localUserVote === 'UNSURE')) && <Lock className="h-3 w-3" />}
                <HelpCircle className="h-4 w-4" />
                Not Sure
              </Button>
            </div>
          )}
          

          {!user && (
            <p className="text-center text-sm text-zinc-500">
              Sign in to vote
            </p>
          )}
        </CardContent>
      </Card>

      {/* Comments Section */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Comments ({comments.length})
          </h2>

          {/* Comments list */}
          <div className="space-y-4">
            {!canSeeResults ? (
              <p className="text-sm text-zinc-500">Vote to see comments</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-zinc-500">No comments yet. Be the first to comment!</p>
            ) : (
              comments.map((comment) => {
                const isAIComment = comment.is_ai === true;
                
                return (
                <div key={comment.id} className={cn(
                  "group flex gap-3",
                  isAIComment && "rounded-lg bg-gradient-to-r from-violet-50 to-indigo-50 p-3 dark:from-violet-950/30 dark:to-indigo-950/30"
                )}>
                  {isAIComment ? (
                    <Link href="/profile/ai">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 transition-opacity hover:opacity-80">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                    </Link>
                  ) : (
                    <Link href={`/profile/${comment.user_id}`}>
                      <Avatar
                        src={comment.avatar_url}
                        fallback={comment.username || 'A'}
                        size="sm"
                      />
                    </Link>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {isAIComment ? (
                        <Link href="/profile/ai" className="text-sm font-medium bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent hover:opacity-80">
                          AI
                        </Link>
                      ) : (
                        <Link 
                          href={`/profile/${comment.user_id}`}
                          className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                        >
                          {comment.username || 'Anonymous'}
                        </Link>
                      )}
                      <span className="text-xs text-zinc-400">
                        {getTimeAgo(new Date(comment.created_at))}
                      </span>
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
                      <p className="text-sm text-zinc-700 dark:text-zinc-300 break-words">
                        {renderCommentContent(comment.content)}
                      </p>
                    )}
                  </div>
                </div>
              );
              })
            )}
          </div>

          {/* Comment form */}
          {user && canSeeResults ? (
            <div className="relative mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              {/* Mention suggestions */}
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
                      {suggestionUser.is_ai ? (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                      ) : (
                        <Avatar src={suggestionUser.avatar_url} fallback={suggestionUser.username} size="sm" />
                      )}
                      <span className={cn(
                        "font-medium",
                        suggestionUser.is_ai 
                          ? "bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent"
                          : "text-zinc-900 dark:text-zinc-100"
                      )}>
                        {suggestionUser.username}
                      </span>
                      {suggestionUser.is_ai && (
                        <span className="text-xs text-zinc-500">Ask AI anything</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <div 
                  className="flex flex-1 flex-wrap items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 focus-within:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
                  onClick={() => inputRef.current?.focus()}
                >
                  {mentionedUsers.map((taggedUser) => (
                    <span
                      key={taggedUser.id}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-xs font-medium",
                        taggedUser.is_ai 
                          ? "bg-gradient-to-r from-violet-100 to-indigo-100 text-violet-700 dark:from-violet-900/40 dark:to-indigo-900/40 dark:text-violet-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                      )}
                    >
                      {taggedUser.is_ai ? (
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500">
                          <Bot className="h-2.5 w-2.5 text-white" />
                        </div>
                      ) : (
                        <Avatar src={taggedUser.avatar_url} fallback={taggedUser.username} size="xs" />
                      )}
                      <span>{taggedUser.is_ai ? taggedUser.username : `@${taggedUser.username}`}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMentionedUsers(prev => prev.filter(u => u.id !== taggedUser.id));
                        }}
                        className={cn(
                          "ml-0.5",
                          taggedUser.is_ai
                            ? "text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-200"
                            : "text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                        )}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    ref={inputRef}
                    type="text"
                    value={commentText}
                    onChange={handleCommentChange}
                    placeholder={mentionedUsers.length > 0 ? "Add your message..." : "Add a comment... (use @ to mention)"}
                    className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-base placeholder:text-zinc-400 focus:outline-none dark:placeholder:text-zinc-500"
                    onKeyDown={handleMentionKeyDown}
                  />
                </div>
                <Button
                  onClick={submitComment}
                  disabled={(!commentText.trim() && mentionedUsers.length === 0) || submittingComment}
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
            <p className="mt-6 border-t border-zinc-200 pt-4 text-sm text-zinc-500 dark:border-zinc-700">
              Sign in to comment
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

