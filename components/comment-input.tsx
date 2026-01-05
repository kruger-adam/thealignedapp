'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { Send, Bot, Wand2, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { MentionSuggestion, AI_MENTION, Comment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';

interface CommentInputProps {
  questionId: string;
  questionAuthorId: string;
  userId: string;
  userMetadata: {
    name?: string;
    email?: string;
    avatar_url?: string;
  };
  onCommentAdded: (comment: Comment) => void;
  onAICommentAdded?: (comment: Comment) => void;
  onAIThinking?: (placeholderId: string) => void;
  onAIStreaming?: (placeholderId: string, content: string) => void;
  onAIError?: (placeholderId: string, error: string) => void;
}

export function CommentInput({
  questionId,
  questionAuthorId: _questionAuthorId, // Unused - handled by API route
  userId,
  userMetadata,
  onCommentAdded,
  onAICommentAdded,
  onAIThinking,
  onAIStreaming,
  onAIError,
}: CommentInputProps) {
  const [commentText, setCommentText] = useState('');
  const [mentionedUsers, setMentionedUsers] = useState<MentionSuggestion[]>([]);
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isRewording, setIsRewording] = useState(false);
  const [rewordSuggestion, setRewordSuggestion] = useState<string | null>(null);
  const { showToast } = useToast();

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

  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);

  // Search users for @mention autocomplete
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
  };

  const insertMention = (user: MentionSuggestion) => {
    // Add user to mentioned list if not already there
    if (!mentionedUsers.some((u) => u.id === user.id)) {
      setMentionedUsers((prev) => [...prev, user]);
    }

    // Remove the @query from the text
    const beforeAt = commentText.substring(0, mentionStartIndex);
    const afterQuery = commentText.substring(mentionStartIndex + mentionQuery.length + 1);
    setCommentText(beforeAt + afterQuery);

    setShowMentions(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
    inputRef.current?.focus();
  };

  const handleMentionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showMentions || mentionSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev < mentionSuggestions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev > 0 ? prev - 1 : mentionSuggestions.length - 1));
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
    if (!commentText.trim() && mentionedUsers.length === 0) return;

    setSubmittingComment(true);
    try {
      const messageText = commentText.trim();

      // Create comment via API route (includes rate limiting)
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          content: messageText,
          mentionedUsers: mentionedUsers.map((u) => ({
            id: u.id,
            username: u.username,
            is_ai: u.is_ai,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle rate limit error
        if (response.status === 429) {
          showToast(data.error || 'Rate limit reached. Please try again later.', 'error');
        } else {
          showToast(data.error || 'Failed to post comment', 'error');
        }
        setSubmittingComment(false);
        return;
      }

      const newComment = data.comment;

      // Build content with mentions for AI check
      const mentionStrings = mentionedUsers.map((u) =>
        u.is_ai ? '@AI' : `@[${u.username}](${u.id})`
      );
      const contentToSave = mentionStrings.length > 0
        ? messageText
          ? `${mentionStrings.join(' ')} ${messageText}`
          : mentionStrings.join(' ')
        : messageText;

      // Add the new comment to the list
      const comment: Comment = {
        id: newComment.id,
        user_id: newComment.user_id,
        content: newComment.content,
        created_at: newComment.created_at,
        username: userMetadata.name || userMetadata.email?.split('@')[0] || 'Anonymous',
        avatar_url: userMetadata.avatar_url || null,
      };
      onCommentAdded(comment);

      // Clear input immediately after posting (don't wait for AI)
      setCommentText('');
      setMentionedUsers([]);
      setSubmittingComment(false);

      // Check if comment mentions @AI
      const hasAIMention = contentToSave.toLowerCase().includes('@ai');

      if (hasAIMention) {
        // Show "AI is thinking..." placeholder
        const aiPlaceholderId = `ai-thinking-${Date.now()}`;
        if (onAIThinking) {
          onAIThinking(aiPlaceholderId);
        }

        // Call the AI API with streaming
        try {
          const aiResponse = await fetch('/api/ai-comment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionId: questionId,
              userQuery: contentToSave,
              userId: userId,
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
              
              // Check for comment metadata at end of stream
              if (chunk.includes('__COMMENT_DATA__:')) {
                const [textPart, dataPart] = chunk.split('__COMMENT_DATA__:');
                if (textPart.trim()) {
                  streamedContent += textPart.replace(/\n\n$/, '');
                  if (onAIStreaming) {
                    onAIStreaming(aiPlaceholderId, streamedContent);
                  }
                }
                
                // Parse the comment data and finalize
                try {
                  const commentData = JSON.parse(dataPart);
                  if (onAICommentAdded) {
                    onAICommentAdded({
                      id: commentData.id,
                      user_id: userId,
                      content: streamedContent,
                      created_at: commentData.created_at,
                      username: 'AI',
                      avatar_url: null,
                      is_ai: true,
                    });
                  }
                } catch {
                  console.error('Failed to parse comment data');
                }
              } else {
                streamedContent += chunk;
                if (onAIStreaming) {
                  onAIStreaming(aiPlaceholderId, streamedContent);
                }
              }
            }
          } else {
            const errorData = await aiResponse.json();
            if (onAIError) {
              onAIError(aiPlaceholderId, errorData.error || "Sorry, I couldn't respond right now.");
            }
          }
        } catch (aiErr) {
          console.error('AI comment error:', aiErr);
          if (onAIError) {
            onAIError(aiPlaceholderId, "Sorry, I couldn't respond right now.");
          }
        }
      }
    } catch (err) {
      console.error('Error submitting comment:', err);
      setSubmittingComment(false);
    }
  };

  return (
    <div className="relative space-y-2">
      {/* Reword suggestion */}
      {rewordSuggestion && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-950/50">
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

      {/* Mention suggestions */}
      {showMentions && mentionSuggestions.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {mentionSuggestions.map((suggestionUser, index) => (
            <button
              key={suggestionUser.id}
              type="button"
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700',
                index === selectedMentionIndex && 'bg-zinc-100 dark:bg-zinc-700'
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
              <span
                className={cn(
                  'font-medium',
                  suggestionUser.is_ai
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent'
                    : 'text-zinc-900 dark:text-zinc-100'
                )}
              >
                {suggestionUser.username}
              </span>
              {suggestionUser.is_ai && <span className="text-xs text-zinc-500">Ask AI anything</span>}
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
                'inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-1.5 text-xs font-medium',
                taggedUser.is_ai
                  ? 'bg-gradient-to-r from-violet-100 to-indigo-100 text-violet-700 dark:from-violet-900/40 dark:to-indigo-900/40 dark:text-violet-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
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
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={commentText}
            onChange={handleCommentChange}
            placeholder={mentionedUsers.length > 0 ? 'Add your message...' : 'Add a comment... (use @ to mention)'}
            className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-base placeholder:text-zinc-400 focus:outline-none dark:placeholder:text-zinc-500"
            onKeyDown={(e) => {
              handleMentionKeyDown(e);
              if (e.key === 'Enter' && !showMentions) {
                e.preventDefault();
                submitComment();
              }
              // Remove last chip on backspace when input is empty
              if (e.key === 'Backspace' && commentText === '' && mentionedUsers.length > 0) {
                e.preventDefault();
                setMentionedUsers((prev) => prev.slice(0, -1));
              }
            }}
          />
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleReword}
          disabled={isRewording || !commentText.trim() || submittingComment}
          className="flex-shrink-0"
          title="AI will suggest a reworded version"
        >
          {isRewording ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={submitComment}
          disabled={submittingComment || (!commentText.trim() && mentionedUsers.length === 0)}
          className="flex-shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

