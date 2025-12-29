'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bot, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Comment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface CommentListProps {
  comments: Comment[];
  currentUserId?: string;
  questionId: string;
  onCommentUpdated: (commentId: string, newContent: string) => void;
  onCommentDeleted: (commentId: string) => void;
  renderCommentContent: (content: string) => React.ReactNode;
  getTimeAgo: (date: Date) => string;
}

export function CommentList({
  comments,
  currentUserId,
  questionId,
  onCommentUpdated,
  onCommentDeleted,
  renderCommentContent,
  getTimeAgo,
}: CommentListProps) {
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editedCommentContent, setEditedCommentContent] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  const supabase = createClient();

  const startEditingComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    // Convert stored format back to readable format
    const readableContent = comment.content.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
    setEditedCommentContent(readableContent);
  };

  const saveCommentEdit = async (commentId: string) => {
    if (!editedCommentContent.trim()) return;
    
    setSavingComment(true);
    try {
      const { error } = await supabase
        .from('comments')
        .update({ content: editedCommentContent.trim() })
        .eq('id', commentId);
      
      if (!error) {
        onCommentUpdated(commentId, editedCommentContent.trim());
        setEditingCommentId(null);
        setEditedCommentContent('');
      }
    } catch (err) {
      console.error('Error saving comment:', err);
    }
    setSavingComment(false);
  };

  const deleteComment = async (commentId: string, commentUserId: string) => {
    if (currentUserId !== commentUserId) return;
    
    setDeletingCommentId(commentId);
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);
      
      if (!error) {
        onCommentDeleted(commentId);
      }
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
    setDeletingCommentId(null);
  };

  if (comments.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No comments yet. Be the first to comment!</p>
    );
  }

  return (
    <div className="space-y-3">
      {comments.map((comment) => {
        const isAIComment = comment.is_ai === true;
        const isThinking = comment.isThinking;
        const isError = comment.isError;

        return (
          <div
            key={comment.id}
            className={cn(
              'group flex gap-3',
              isAIComment &&
                'rounded-lg bg-gradient-to-r from-violet-50 to-indigo-50 p-3 dark:from-violet-950/30 dark:to-indigo-950/30'
            )}
          >
            {isAIComment ? (
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500">
                <Bot className={cn('h-4 w-4 text-white', isThinking && 'animate-pulse')} />
              </div>
            ) : (
              <Link href={`/profile/${comment.user_id}`}>
                <Avatar
                  src={comment.avatar_url}
                  fallback={comment.username || ''}
                  size="sm"
                  className="h-8 w-8 flex-shrink-0"
                />
              </Link>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {isAIComment ? (
                  <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-sm font-medium text-transparent">
                    AI
                  </span>
                ) : (
                  <Link
                    href={`/profile/${comment.user_id}`}
                    className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                  >
                    {comment.username}
                  </Link>
                )}
                {!isThinking && (
                  <span className="text-xs text-zinc-500">{getTimeAgo(new Date(comment.created_at))}</span>
                )}
                {isThinking && <span className="animate-pulse text-xs text-violet-500">thinking...</span>}
                {isError && <span className="text-xs text-rose-500">error</span>}
                {comment.updated_at &&
                  new Date(comment.updated_at).getTime() > new Date(comment.created_at).getTime() + 1000 && (
                    <span className="text-xs italic text-zinc-400">(edited)</span>
                  )}
                {currentUserId === comment.user_id && !isAIComment && editingCommentId !== comment.id && (
                  <DropdownMenu trigger={<MoreHorizontal className="h-3.5 w-3.5 text-zinc-400" />} align="right">
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
                      {savingComment ? '...' : 'Save'}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="break-words text-sm text-zinc-700 dark:text-zinc-300">
                  {renderCommentContent(comment.content)}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

