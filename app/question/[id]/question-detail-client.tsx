'use client';

import React, { useState, useTransition, useMemo, useRef, useCallback, useEffect } from 'react';
import { ArrowLeft, Check, HelpCircle, X, Send, Clock, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';
import { QuestionWithStats, VoteType } from '@/lib/types';
import { cn } from '@/lib/utils';

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
}

interface Voter {
  id: string;
  username: string | null;
  avatar_url: string | null;
  vote: VoteType;
}

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
  const supabase = useMemo(() => createClient(), []);
  const [isPending, startTransition] = useTransition();
  
  // Vote state
  const [localUserVote, setLocalUserVote] = useState<VoteType | null>(question.user_vote ?? null);
  const [localStats, setLocalStats] = useState(question.stats);
  
  // Voters state
  const [showVoters, setShowVoters] = useState(false);
  const [voters, setVoters] = useState<Voter[]>([]);
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
  const [localQuestionContent, setLocalQuestionContent] = useState(question.content);
  const [questionWasEdited, setQuestionWasEdited] = useState(
    question.updated_at && new Date(question.updated_at).getTime() > new Date(question.created_at).getTime() + 1000
  );
  
  // Comment editing state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editedCommentContent, setEditedCommentContent] = useState('');
  const [savingComment, setSavingComment] = useState(false);

  const timeAgo = getTimeAgo(new Date(question.created_at));

  // Vote handling
  const updateVoteState = (newVote: VoteType) => {
    const oldVote = localUserVote;
    const newStats = { ...localStats };

    if (oldVote) {
      if (oldVote === 'YES') newStats.yes_count--;
      else if (oldVote === 'NO') newStats.no_count--;
      else newStats.unsure_count--;
      newStats.total_votes--;
    }

    if (newVote) {
      if (newVote === 'YES') newStats.yes_count++;
      else if (newVote === 'NO') newStats.no_count++;
      else newStats.unsure_count++;
      newStats.total_votes++;
    }

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

    const isFirstVote = !localUserVote;
    updateVoteState(vote);

    startTransition(async () => {
      const { error } = await supabase
        .from('responses')
        .upsert(
          {
            user_id: user.id,
            question_id: question.id,
            vote,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,question_id' }
        );

      if (error) {
        console.error('Error voting:', error);
        return;
      }

      // Notify question author on first vote
      if (isFirstVote && question.author_id !== user.id) {
        supabase.from('notifications').insert({
          user_id: question.author_id,
          type: 'vote',
          actor_id: user.id,
          question_id: question.id,
        });
      }
    });
  };

  // Fetch voters
  const fetchVoters = async () => {
    if (voters.length > 0) {
      setShowVoters(!showVoters);
      return;
    }
    
    setLoadingVoters(true);
    try {
      const { data: responses } = await supabase
        .from('responses')
        .select('vote, user_id')
        .eq('question_id', question.id);
      
      if (responses && responses.length > 0) {
        const userIds = responses.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);
        
        const profileMap = Object.fromEntries(
          (profiles || []).map(p => [p.id, p])
        );
        
        const votersList: Voter[] = responses.map(r => ({
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

  // Start editing a comment
  const startEditingComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditedCommentContent(comment.content);
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
      const mentionStrings = mentionedUsers.map(u => `@[${u.username}](${u.id})`);
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
        // Create notifications
        const notifications: Array<{
          user_id: string;
          type: 'mention' | 'comment';
          actor_id: string;
          question_id: string;
          comment_id: string;
        }> = [];
        
        mentionedUsers
          .filter(u => u.id !== user.id)
          .forEach(mentionedUser => {
            notifications.push({
              user_id: mentionedUser.id,
              type: 'mention',
              actor_id: user.id,
              question_id: question.id,
              comment_id: newComment.id,
            });
          });
        
        if (question.author_id !== user.id && !mentionedUsers.some(u => u.id === question.author_id)) {
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
        setCommentText('');
        setMentionedUsers([]);
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
    <main className="mx-auto max-w-2xl px-4 py-6">
      {/* Back button */}
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
        <ArrowLeft className="h-4 w-4" />
        Back to feed
      </Link>

      {/* Question Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          {/* Author */}
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
              {questionWasEdited && (
                <span className="text-xs text-zinc-400 italic">(edited)</span>
              )}
              {user?.id === question.author_id && (
                <button
                  onClick={() => setIsEditingQuestion(true)}
                  className="absolute -right-1 -top-1 rounded p-1 opacity-0 transition-opacity hover:bg-zinc-100 group-hover:opacity-100 dark:hover:bg-zinc-700"
                  title="Edit question"
                >
                  <Pencil className="h-4 w-4 text-zinc-400" />
                </button>
              )}
            </div>
          )}

          {/* Vote stats */}
          {localStats.total_votes > 0 && (
            <div className="mb-4">
              <ProgressBar
                yes={localStats.yes_percentage}
                no={localStats.no_percentage}
                unsure={localStats.unsure_percentage}
              />
              <button
                onClick={fetchVoters}
                className="mt-2 flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
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
              {showVoters && voters.length > 0 && (
                <div className="mt-3 space-y-3">
                  {/* Yes voters */}
                  {voters.filter(v => v.vote === 'YES').length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-emerald-600">Yes</p>
                      <div className="flex flex-wrap gap-2">
                        {voters.filter(v => v.vote === 'YES').map(voter => (
                          <Link
                            key={voter.id}
                            href={`/profile/${voter.id}`}
                            className="flex items-center gap-1.5 rounded-full bg-emerald-50 py-1 pl-1 pr-2.5 text-xs hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50"
                          >
                            <Avatar src={voter.avatar_url} fallback={voter.username || 'A'} size="xs" />
                            <span className="text-emerald-700 dark:text-emerald-300">{voter.username}</span>
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
                          <Link
                            key={voter.id}
                            href={`/profile/${voter.id}`}
                            className="flex items-center gap-1.5 rounded-full bg-rose-50 py-1 pl-1 pr-2.5 text-xs hover:bg-rose-100 dark:bg-rose-900/30 dark:hover:bg-rose-900/50"
                          >
                            <Avatar src={voter.avatar_url} fallback={voter.username || 'A'} size="xs" />
                            <span className="text-rose-700 dark:text-rose-300">{voter.username}</span>
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
                          <Link
                            key={voter.id}
                            href={`/profile/${voter.id}`}
                            className="flex items-center gap-1.5 rounded-full bg-amber-50 py-1 pl-1 pr-2.5 text-xs hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/50"
                          >
                            <Avatar src={voter.avatar_url} fallback={voter.username || 'A'} size="xs" />
                            <span className="text-amber-700 dark:text-amber-300">{voter.username}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
                  localUserVote === 'YES' && 'bg-emerald-600 hover:bg-emerald-700'
                )}
              >
                <Check className="h-4 w-4" />
                Yes
              </Button>
              <Button
                variant={localUserVote === 'NO' ? 'default' : 'outline'}
                onClick={() => handleVote('NO')}
                disabled={isPending}
                className={cn(
                  'gap-2',
                  localUserVote === 'NO' && 'bg-rose-600 hover:bg-rose-700'
                )}
              >
                <X className="h-4 w-4" />
                No
              </Button>
              <Button
                variant={localUserVote === 'UNSURE' ? 'default' : 'outline'}
                onClick={() => handleVote('UNSURE')}
                disabled={isPending}
                className={cn(
                  'gap-2',
                  localUserVote === 'UNSURE' && 'bg-amber-600 hover:bg-amber-700'
                )}
              >
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
            {comments.length === 0 ? (
              <p className="text-sm text-zinc-500">No comments yet. Be the first to comment!</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="group flex gap-3">
                  <Link href={`/profile/${comment.user_id}`}>
                    <Avatar
                      src={comment.avatar_url}
                      fallback={comment.username || 'A'}
                      size="sm"
                    />
                  </Link>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Link 
                        href={`/profile/${comment.user_id}`}
                        className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        {comment.username || 'Anonymous'}
                      </Link>
                      <span className="text-xs text-zinc-400">
                        {getTimeAgo(new Date(comment.created_at))}
                      </span>
                      {comment.updated_at && new Date(comment.updated_at).getTime() > new Date(comment.created_at).getTime() + 1000 && (
                        <span className="text-xs text-zinc-400 italic">(edited)</span>
                      )}
                      {user?.id === comment.user_id && editingCommentId !== comment.id && (
                        <button
                          onClick={() => startEditingComment(comment)}
                          className="rounded p-0.5 opacity-0 transition-opacity hover:bg-zinc-100 group-hover:opacity-100 dark:hover:bg-zinc-700"
                          title="Edit comment"
                        >
                          <Pencil className="h-3 w-3 text-zinc-400" />
                        </button>
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
              ))
            )}
          </div>

          {/* Comment form */}
          {user ? (
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
                      <Avatar src={suggestionUser.avatar_url} fallback={suggestionUser.username} size="sm" />
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{suggestionUser.username}</span>
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
                      className="inline-flex items-center gap-1 rounded-full bg-blue-100 py-0.5 pl-0.5 pr-2 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                    >
                      <Avatar src={taggedUser.avatar_url} fallback={taggedUser.username} size="xs" />
                      <span>@{taggedUser.username}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMentionedUsers(prev => prev.filter(u => u.id !== taggedUser.id));
                        }}
                        className="ml-0.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
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
            <p className="mt-6 border-t border-zinc-200 pt-4 text-sm text-zinc-500 dark:border-zinc-700">
              Sign in to comment
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

