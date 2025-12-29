'use client';

import React, { useState, useTransition, useMemo, useEffect, useRef, useCallback } from 'react';
import { Check, HelpCircle, X, MessageCircle, Clock, ChevronDown, ChevronUp, Send, Pencil, Lock, Vote, MoreHorizontal, Trash2, Share2, Bot } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { ProgressBar } from '@/components/ui/progress-bar';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';
import { QuestionWithStats, VoteType } from '@/lib/types';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { triggerInstallPrompt } from '@/components/install-prompt';

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
  is_ai?: boolean;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  username: string | null;
  avatar_url: string | null;
}

interface MentionSuggestion {
  id: string;
  username: string;
  avatar_url: string | null;
  is_ai?: boolean;
}

// Special AI mention suggestion
const AI_MENTION: MentionSuggestion = {
  id: 'ai',
  username: 'AI',
  avatar_url: null,
  is_ai: true,
};

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
  const [anonymousCounts, setAnonymousCounts] = useState<{ YES: number; NO: number; UNSURE: number }>({ YES: 0, NO: 0, UNSURE: 0 });
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

  const fetchVoters = async () => {
    if (voters.length > 0 || anonymousCounts.YES > 0 || anonymousCounts.NO > 0 || anonymousCounts.UNSURE > 0) {
      // Already fetched, just toggle
      setShowVoters(!showVoters);
      return;
    }
    
    setLoadingVoters(true);
    try {
      // Fetch all votes (including anonymous and AI)
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/responses?select=vote,user_id,is_anonymous,is_ai&question_id=eq.${question.id}`;
      const res = await fetch(url, {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      });
      const responses: { user_id: string; vote: string; is_anonymous: boolean; is_ai?: boolean }[] = await res.json();
      
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
  // Removes @query from input, shows chip instead
  const insertMention = (selectedUser: MentionSuggestion) => {
    if (mentionStartIndex === -1) return;
    
    const beforeMention = commentText.substring(0, mentionStartIndex);
    const afterMention = commentText.substring(mentionStartIndex + mentionQuery.length + 1);
    // Remove the @query from input - the chip will show the mention
    const newText = `${beforeMention}${afterMention}`.trim();
    
    setCommentText(newText);
    // Track this user - chip displays the mention, submit adds @[username](id)
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

  const submitComment = async () => {
    if (!user || (!commentText.trim() && mentionedUsers.length === 0)) return;
    
    setSubmittingComment(true);
    try {
      // Build content: prepend mentions as @[username](id), then add the message
      // For AI mentions, just use @AI (no ID needed)
      const mentionStrings = mentionedUsers.map(u => 
        u.is_ai ? '@AI' : `@[${u.username}](${u.id})`
      );
      const messageText = commentText.trim();
      const contentToSave = mentionStrings.length > 0 
        ? messageText 
          ? `${mentionStrings.join(' ')} ${messageText}`
          : mentionStrings.join(' ')
        : messageText;
      
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
        
        // Notify mentioned users (skip AI and self)
        if (mentionedUsers.length > 0) {
          mentionedUsers
            .filter(u => u.id !== user.id && !u.is_ai) // Don't notify yourself or AI
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
        
        // Notify followers about the comment
        supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', user.id)
          .then(({ data: followers }) => {
            if (followers && followers.length > 0) {
              // Don't notify: question author (already notified), mentioned users (already notified)
              const alreadyNotified = new Set([
                question.author_id,
                ...mentionedUsers.filter(u => !u.is_ai).map(u => u.id),
              ]);
              
              const followerNotifications = followers
                .filter(f => !alreadyNotified.has(f.follower_id))
                .map(f => ({
                  user_id: f.follower_id,
                  type: 'comment' as const,
                  actor_id: user.id,
                  question_id: question.id,
                  comment_id: newComment.id,
                }));
              
              if (followerNotifications.length > 0) {
                supabase.from('notifications').insert(followerNotifications);
              }
            }
          });
        
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
        setShowComments(true);
        
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
            isThinking: true,
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
              setCommentCount(prev => prev + 1);
            } else {
              const errorData = await aiResponse.json();
              // Replace placeholder with error message
              setComments(prev => prev.map(c => 
                c.id === aiPlaceholderId 
                  ? {
                      ...c,
                      content: errorData.error || 'Sorry, I couldn\'t respond right now.',
                      isThinking: false,
                      isError: true,
                    }
                  : c
              ));
            }
          } catch (aiError) {
            console.error('AI comment error:', aiError);
            // Remove placeholder on error
            setComments(prev => prev.filter(c => c.id !== aiPlaceholderId));
          }
        }
      }
    } catch (err) {
      console.error('Error submitting comment:', err);
      setSubmittingComment(false);
    }
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
    if (!user) return;

    // Check if user is clicking the same vote to unvote
    const isUnvoting = localUserVote === vote;
    
    // Check if this is the user's first vote on this question
    const isFirstVote = !localUserVote;

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
        // Perform the actual update/insert
        const { error } = await supabase
          .from('responses')
          .upsert(
            {
              user_id: user.id,
              question_id: question.id,
              vote,
              is_anonymous: isPrivateMode,
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
        
        // Reset private mode after voting
        if (isPrivateMode) {
          setIsPrivateMode(false);
        }

        // Trigger install prompt on first vote
        if (isFirstVote) {
          triggerInstallPrompt();
        }

        // Notify question author (only on first vote, not vote changes)
        // Don't notify yourself, and don't notify for anonymous votes
        if (isFirstVote && question.author_id !== user.id && !isPrivateMode) {
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

        onVote?.(question.id, vote);
      }
    });
  };

  const hasVoted = !!optimisticData.userVote;
  const timeAgo = getTimeAgo(new Date(question.created_at));

  return (
    <Card className="transition-all duration-200 hover:shadow-md">
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
              <Vote className="h-3.5 w-3.5" />
              <span>{optimisticData.stats.total_votes}<span className="hidden sm:inline"> vote{optimisticData.stats.total_votes !== 1 ? 's' : ''}</span></span>
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
              <span>{commentCount}<span className="hidden sm:inline"> comment{commentCount !== 1 ? 's' : ''}</span></span>
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
      {showVoters && (voters.length > 0 || anonymousCounts.YES > 0 || anonymousCounts.NO > 0 || anonymousCounts.UNSURE > 0) && (
        <div className="border-t border-zinc-100 px-6 py-3 dark:border-zinc-800">
          <div className="space-y-3">
            {/* Yes voters */}
            {(voters.filter(v => v.vote === 'YES').length > 0 || anonymousCounts.YES > 0) && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-emerald-600">Yes</p>
                <div className="flex flex-wrap gap-2">
                  {voters.filter(v => v.vote === 'YES').map((voter, idx) => (
                    voter.is_ai ? (
                      <div key={`ai-yes-${idx}`} className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-100 to-indigo-100 py-1 pl-1 pr-2.5 dark:from-violet-950/40 dark:to-indigo-950/40">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500">
                          <Bot className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-xs font-medium bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">AI</span>
                      </div>
                    ) : (
                      <Link key={voter.id} href={`/profile/${voter.id}`}>
                        <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 py-1 pl-1 pr-2.5 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40">
                          <Avatar src={voter.avatar_url} fallback={voter.username || ''} size="sm" className="h-5 w-5" />
                          <span className="text-xs text-emerald-700 dark:text-emerald-300">{voter.username}</span>
                        </div>
                      </Link>
                    )
                  ))}
                  {anonymousCounts.YES > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full bg-emerald-50/50 py-1 px-2.5 dark:bg-emerald-950/20">
                      <Lock className="h-3 w-3 text-emerald-400" />
                      <span className="text-xs italic text-emerald-500 dark:text-emerald-400">
                        +{anonymousCounts.YES} privately
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* No voters */}
            {(voters.filter(v => v.vote === 'NO').length > 0 || anonymousCounts.NO > 0) && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-rose-600">No</p>
                <div className="flex flex-wrap gap-2">
                  {voters.filter(v => v.vote === 'NO').map((voter, idx) => (
                    voter.is_ai ? (
                      <div key={`ai-no-${idx}`} className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-100 to-indigo-100 py-1 pl-1 pr-2.5 dark:from-violet-950/40 dark:to-indigo-950/40">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500">
                          <Bot className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-xs font-medium bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">AI</span>
                      </div>
                    ) : (
                      <Link key={voter.id} href={`/profile/${voter.id}`}>
                        <div className="flex items-center gap-1.5 rounded-full bg-rose-50 py-1 pl-1 pr-2.5 transition-colors hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40">
                          <Avatar src={voter.avatar_url} fallback={voter.username || ''} size="sm" className="h-5 w-5" />
                          <span className="text-xs text-rose-700 dark:text-rose-300">{voter.username}</span>
                        </div>
                      </Link>
                    )
                  ))}
                  {anonymousCounts.NO > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full bg-rose-50/50 py-1 px-2.5 dark:bg-rose-950/20">
                      <Lock className="h-3 w-3 text-rose-400" />
                      <span className="text-xs italic text-rose-500 dark:text-rose-400">
                        +{anonymousCounts.NO} privately
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Not Sure voters */}
            {(voters.filter(v => v.vote === 'UNSURE').length > 0 || anonymousCounts.UNSURE > 0) && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-amber-600">Not Sure</p>
                <div className="flex flex-wrap gap-2">
                  {voters.filter(v => v.vote === 'UNSURE').map((voter, idx) => (
                    voter.is_ai ? (
                      <div key={`ai-unsure-${idx}`} className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-100 to-indigo-100 py-1 pl-1 pr-2.5 dark:from-violet-950/40 dark:to-indigo-950/40">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500">
                          <Bot className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-xs font-medium bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">AI</span>
                      </div>
                    ) : (
                      <Link key={voter.id} href={`/profile/${voter.id}`}>
                        <div className="flex items-center gap-1.5 rounded-full bg-amber-50 py-1 pl-1 pr-2.5 transition-colors hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40">
                          <Avatar src={voter.avatar_url} fallback={voter.username || ''} size="sm" className="h-5 w-5" />
                          <span className="text-xs text-amber-700 dark:text-amber-300">{voter.username}</span>
                        </div>
                      </Link>
                    )
                  ))}
                  {anonymousCounts.UNSURE > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full bg-amber-50/50 py-1 px-2.5 dark:bg-amber-950/20">
                      <Lock className="h-3 w-3 text-amber-400" />
                      <span className="text-xs italic text-amber-500 dark:text-amber-400">
                        +{anonymousCounts.UNSURE} privately
                      </span>
                    </div>
                  )}
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
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500">
                      <Bot className={cn("h-4 w-4 text-white", isThinking && "animate-pulse")} />
                    </div>
                  ) : (
                    <Link href={`/profile/${comment.user_id}`}>
                      <Avatar src={comment.avatar_url} fallback={comment.username || ''} size="sm" className="h-8 w-8 flex-shrink-0" />
                    </Link>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isAIComment ? (
                        <span className="text-sm font-medium bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                          AI
                        </span>
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
                        isThinking && "text-zinc-400 dark:text-zinc-500"
                      )}>
                        {isThinking ? '...' : renderCommentContent(comment.content)}
                      </p>
                    )}
                  </div>
                </div>
              );})
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
                        {suggestionUser.is_ai ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500">
                            <Bot className="h-4 w-4 text-white" />
                          </div>
                        ) : (
                          <Avatar
                            src={suggestionUser.avatar_url}
                            fallback={suggestionUser.username}
                            size="sm"
                          />
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
                  {/* Input container with inline chips */}
                  <div 
                    className="flex flex-1 flex-wrap items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 focus-within:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
                    onClick={() => inputRef.current?.focus()}
                  >
                    {/* Tagged Users Chips - inline */}
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
                          <Avatar
                            src={taggedUser.avatar_url}
                            fallback={taggedUser.username}
                            size="xs"
                          />
                        )}
                        <span>{taggedUser.is_ai ? 'AI' : `@${taggedUser.username}`}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMentionedUsers(prev => prev.filter(u => u.id !== taggedUser.id));
                          }}
                          className={cn(
                            "ml-0.5",
                            taggedUser.is_ai 
                              ? "text-violet-500 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-200"
                              : "text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                          )}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {/* Text input */}
                    <input
                      ref={inputRef}
                      type="text"
                      value={commentText}
                      onChange={handleCommentChange}
                      placeholder={mentionedUsers.length > 0 ? "Add your message..." : "Add a comment... (use @ to mention)"}
                      className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-sm placeholder:text-zinc-400 focus:outline-none dark:placeholder:text-zinc-500"
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
              <p className="text-sm text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                Sign in to comment
              </p>
            )}
          </div>
        </div>
      )}
      
      <CardContent className="pb-4">
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
            {questionWasEdited && (
              <span className="text-xs text-zinc-400 italic">(edited)</span>
            )}
            <div className="absolute -right-1 -top-1">
              <DropdownMenu
                trigger={<MoreHorizontal className="h-4 w-4 text-zinc-400" />}
                align="right"
              >
                <DropdownMenuItem onClick={shareQuestion}>
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </DropdownMenuItem>
                {user && (
                  <DropdownMenuItem onClick={() => setIsPrivateMode(!isPrivateMode)}>
                    <Lock className="h-3.5 w-3.5" />
                    {isPrivateMode ? 'Cancel private vote' : 'Vote privately'}
                  </DropdownMenuItem>
                )}
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
      </CardContent>

      <CardFooter className="flex-col gap-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        {/* Private Mode Indicator */}
        {isPrivateMode && (
          <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            <Lock className="h-4 w-4" />
            <span>Private mode: your vote won&apos;t be visible to others</span>
            <button 
              onClick={() => setIsPrivateMode(false)}
              className="ml-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        
        {/* Vote Buttons */}
        <div className="grid w-full grid-cols-3 gap-2">
          <Button
            variant={optimisticData.userVote === 'YES' ? 'yes' : 'yes-outline'}
            size="sm"
            onClick={() => handleVote('YES')}
            disabled={isPending || !user}
            className={cn(
              'flex-1 gap-1.5',
              optimisticData.userVote === 'YES' && 'ring-2 ring-emerald-500/50',
              isPrivateMode && 'border-dashed'
            )}
          >
            {(isPrivateMode || (localVoteIsAnonymous && optimisticData.userVote === 'YES')) && <Lock className="h-3 w-3" />}
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
              optimisticData.userVote === 'NO' && 'ring-2 ring-rose-500/50',
              isPrivateMode && 'border-dashed'
            )}
          >
            {(isPrivateMode || (localVoteIsAnonymous && optimisticData.userVote === 'NO')) && <Lock className="h-3 w-3" />}
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
              optimisticData.userVote === 'UNSURE' && 'ring-2 ring-amber-500/50',
              isPrivateMode && 'border-dashed'
            )}
          >
            {(isPrivateMode || (localVoteIsAnonymous && optimisticData.userVote === 'UNSURE')) && <Lock className="h-3 w-3" />}
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


