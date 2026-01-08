'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { Send, Bot, Wand2, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { MentionSuggestion, AI_MENTION, Comment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/contexts/auth-context';
import { GifPicker } from '@/components/gif-picker';

interface CommentInputProps {
  questionId: string;
  questionAuthorId?: string | null;
  onCommentAdded: (comment: Comment) => void;
  onCommentCountChange?: (delta: number) => void;
  // AI streaming callbacks
  onAIThinking?: (placeholderId: string) => void;
  onAIStreaming?: (placeholderId: string, content: string) => void;
  onAIComplete?: (placeholderId: string, commentData: { id: string; created_at: string }, content: string) => void;
  onAIError?: (placeholderId: string, error: string) => void;
}

export function CommentInput({
  questionId,
  questionAuthorId,
  onCommentAdded,
  onCommentCountChange,
  onAIThinking,
  onAIStreaming,
  onAIComplete,
  onAIError,
}: CommentInputProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  
  // Form state
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [selectedGif, setSelectedGif] = useState<string | null>(null);
  
  // Reword state
  const [isRewording, setIsRewording] = useState(false);
  const [rewordSuggestion, setRewordSuggestion] = useState<string | null>(null);
  
  // Mention autocomplete state
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentionedUsers, setMentionedUsers] = useState<MentionSuggestion[]>([]);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Handle AI reword request
  const handleReword = async () => {
    if (!commentText.trim() || isRewording) return;
    
    setIsRewording(true);
    setRewordSuggestion(null);
    
    try {
      const response = await fetch('/api/ai-reword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: commentText.trim(),
          type: 'comment',
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        showToast(data.error || 'Failed to reword comment', 'error');
        setIsRewording(false);
        return;
      }
      
      setRewordSuggestion(data.reworded);
    } catch (error) {
      console.error('Error rewording:', error);
      showToast('Failed to reword comment. Please try again.', 'error');
    } finally {
      setIsRewording(false);
    }
  };
  
  // Accept the reword suggestion
  const acceptReword = () => {
    if (rewordSuggestion) {
      setCommentText(rewordSuggestion);
      setRewordSuggestion(null);
      inputRef.current?.focus();
    }
  };
  
  // Decline the reword suggestion
  const declineReword = () => {
    setRewordSuggestion(null);
    inputRef.current?.focus();
  };

  // Search users for @mention autocomplete
  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 1) {
      setMentionSuggestions([]);
      setShowMentions(false);
      return;
    }
    
    try {
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
  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setCommentText(value);
    
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
    
    // Find the @ symbol before cursor
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

  // Insert selected mention into comment
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

  // Handle keyboard navigation in mention dropdown
  const handleMentionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle backspace to remove last chip when input is empty
    if (e.key === 'Backspace' && commentText === '' && mentionedUsers.length > 0) {
      e.preventDefault();
      setMentionedUsers(prev => prev.slice(0, -1));
      return;
    }
    
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

  const submitComment = async () => {
    if (!user || (!commentText.trim() && mentionedUsers.length === 0 && !selectedGif)) return;
    
    setSubmittingComment(true);
    try {
      // Build content: plain text + GIF (mentions will be prepended by API)
      const messageText = commentText.trim();
      let content = messageText;
      
      // Append GIF if selected
      if (selectedGif) {
        content = content 
          ? `${content} [gif:${selectedGif}]`
          : `[gif:${selectedGif}]`;
      }
      
      // Call API route to create comment (handles notifications + email)
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          content: content || ' ', // API requires content, send space if only mentions
          mentionedUsers,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error creating comment:', errorData.error);
        setSubmittingComment(false);
        return;
      }
      
      const { comment: newComment } = await response.json();
      
      if (newComment) {
        // Notify followers about the comment (still done client-side for now)
        supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', user.id)
          .then(({ data: followers }) => {
            if (followers && followers.length > 0) {
              const alreadyNotified = new Set([
                questionAuthorId,
                ...mentionedUsers.filter(u => !u.is_ai).map(u => u.id),
              ]);
              
              const followerNotifications = followers
                .filter(f => !alreadyNotified.has(f.follower_id))
                .map(f => ({
                  user_id: f.follower_id,
                  type: 'comment' as const,
                  actor_id: user.id,
                  question_id: questionId,
                  comment_id: newComment.id,
                }));
              
              if (followerNotifications.length > 0) {
                supabase.from('notifications').insert(followerNotifications);
              }
            }
          });
        
        // Call parent callback with new comment
        onCommentAdded({
          id: newComment.id,
          user_id: user.id,
          content: newComment.content,
          created_at: newComment.created_at,
          username: user.user_metadata?.name || user.email?.split('@')[0] || 'Anonymous',
          avatar_url: user.user_metadata?.avatar_url || null,
        });
        onCommentCountChange?.(1);
        
        // Clear input immediately after posting
        setCommentText('');
        setMentionedUsers([]);
        setSelectedGif(null);
        setRewordSuggestion(null);
        setSubmittingComment(false);
        
        // Reset textarea height
        if (inputRef.current) {
          inputRef.current.style.height = 'auto';
        }
        
        // Check if comment mentions @AI
        const hasAIMention = mentionedUsers.some(u => u.is_ai);
        
        if (hasAIMention) {
          // Show "AI is thinking..." placeholder
          const aiPlaceholderId = `ai-thinking-${Date.now()}`;
          onAIThinking?.(aiPlaceholderId);
          
          // Call the AI API with streaming
          try {
            const aiResponse = await fetch('/api/ai-comment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                questionId: questionId,
                userQuery: newComment.content,
                userId: user.id,
              }),
            });
            
            if (aiResponse.ok && aiResponse.body) {
              const reader = aiResponse.body.getReader();
              const decoder = new TextDecoder();
              let streamedContent = '';
              
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                streamedContent += chunk;
                
                // Check if we received the comment metadata at the end
                const metadataMatch = streamedContent.match(/\n\n__COMMENT_DATA__:(.+)$/);
                let displayContent = streamedContent;
                let commentData: { id: string; created_at: string } | null = null;
                
                if (metadataMatch) {
                  displayContent = streamedContent.replace(/\n\n__COMMENT_DATA__:.+$/, '');
                  try {
                    commentData = JSON.parse(metadataMatch[1]);
                  } catch {
                    // Ignore parse errors
                  }
                }
                
                if (commentData) {
                  onAIComplete?.(aiPlaceholderId, commentData, displayContent);
                  onCommentCountChange?.(1);
                } else {
                  onAIStreaming?.(aiPlaceholderId, displayContent);
                }
              }
            } else {
              let errorMessage = 'Sorry, I couldn\'t respond right now.';
              try {
                const errorData = await aiResponse.json();
                errorMessage = errorData.error || errorMessage;
              } catch {
                // Ignore parse errors
              }
              onAIError?.(aiPlaceholderId, errorMessage);
            }
          } catch (aiError) {
            console.error('AI comment error:', aiError);
            onAIError?.(aiPlaceholderId, 'Sorry, I couldn\'t respond right now.');
          }
        }
      }
    } catch (err) {
      console.error('Error submitting comment:', err);
      setSubmittingComment(false);
    }
  };

  if (!user) {
    return (
      <p className="text-sm text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800">
        Sign in to comment
      </p>
    );
  }

  return (
    <div className="relative pt-2 border-t border-zinc-100 dark:border-zinc-800">
      {/* Reword suggestion */}
      {rewordSuggestion && (
        <div className="mb-3 rounded-lg border border-violet-200 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-950/50">
          <div className="flex items-start gap-2">
            <Wand2 className="h-4 w-4 mt-0.5 text-violet-600 dark:text-violet-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-violet-700 dark:text-violet-300 mb-1">
                AI Suggestion
              </p>
              <p className="text-sm text-zinc-900 dark:text-zinc-100">
                {rewordSuggestion}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Button
                  size="sm"
                  onClick={acceptReword}
                  className="h-7 gap-1 bg-violet-600 hover:bg-violet-700 text-white"
                >
                  <Check className="h-3 w-3" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={declineReword}
                  className="h-7 gap-1 text-zinc-600 dark:text-zinc-400"
                >
                  <X className="h-3 w-3" />
                  Decline
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reword link - appears when there's text */}
      {commentText.trim() && !rewordSuggestion && (
        <div className="flex justify-end mb-2 animate-in fade-in duration-200">
          <button
            type="button"
            onClick={handleReword}
            disabled={isRewording || submittingComment}
            className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 disabled:opacity-50 transition-colors"
          >
            {isRewording ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Wand2 className="h-3 w-3" />
            )}
            <span>Reword</span>
          </button>
        </div>
      )}

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
                "inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-1.5 text-xs font-medium",
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
            </span>
          ))}
          {/* Text input - auto-expanding textarea */}
          <textarea
            ref={inputRef}
            value={commentText}
            onChange={handleCommentChange}
            placeholder={mentionedUsers.length > 0 ? "Add message..." : "Add a comment..."}
            className="min-w-[80px] flex-1 resize-none border-0 bg-transparent px-1 py-1 text-base placeholder:text-zinc-400 focus:outline-none dark:placeholder:text-zinc-500"
            onKeyDown={handleMentionKeyDown}
            rows={1}
            style={{ height: 'auto', maxHeight: '120px' }}
          />
        </div>
        
        {/* GIF button */}
        <button
          type="button"
          onClick={() => setShowGifPicker(!showGifPicker)}
          className={cn(
            "h-[38px] px-3 rounded-lg transition-colors flex items-center justify-center",
            showGifPicker 
              ? "bg-violet-500 text-white dark:bg-violet-600"
              : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
          )}
          title="Add GIF"
        >
          <span className="text-xs font-bold">GIF</span>
        </button>
        
        {/* Send button */}
        <Button
          onClick={submitComment}
          disabled={(!commentText.trim() && mentionedUsers.length === 0 && !selectedGif) || submittingComment}
          className="h-[38px] px-3"
        >
          {submittingComment ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Selected GIF Preview */}
      {selectedGif && (
        <div className="relative mt-2 inline-block">
          <img
            src={selectedGif}
            alt="Selected GIF"
            className="max-h-32 rounded-lg"
          />
          <button
            type="button"
            onClick={() => setSelectedGif(null)}
            className="absolute -right-2 -top-2 rounded-full bg-zinc-900 p-1 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* GIF Picker */}
      {showGifPicker && (
        <GifPicker
          onSelect={(gifUrl) => {
            setSelectedGif(gifUrl);
            setShowGifPicker(false);
          }}
          onClose={() => setShowGifPicker(false)}
        />
      )}
    </div>
  );
}
