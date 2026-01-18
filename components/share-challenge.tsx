'use client';

import { useState, useCallback, useEffect } from 'react';
import { X, Copy, Check, Users, MessageCircle, Share2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VoteType } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ShareChallengeProps {
  isOpen: boolean;
  onClose: () => void;
  questionId: string;
  questionContent: string;
  userVote: VoteType;
  isAuthor?: boolean;
}

export function ShareChallenge({
  isOpen,
  onClose,
  questionId,
  questionContent,
  userVote,
  isAuthor = false,
}: ShareChallengeProps) {
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create share challenge when modal opens
  useEffect(() => {
    if (isOpen && !shareCode && !isCreating) {
      createShareChallenge();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const createShareChallenge = useCallback(async () => {
    setIsCreating(true);
    setError(null);
    
    try {
      const response = await fetch('/api/share-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          vote: userVote,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Failed to create share link');
        return;
      }
      
      setShareCode(data.code);
    } catch (err) {
      console.error('Error creating share challenge:', err);
      setError('Failed to create share link');
    } finally {
      setIsCreating(false);
    }
  }, [questionId, userVote]);

  const shareUrl = shareCode 
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/challenge/${shareCode}`
    : '';

  const copyToClipboard = useCallback(async () => {
    if (!shareUrl) return;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [shareUrl]);

  // Add question mark only if the question doesn't already end with punctuation
  const questionWithPunctuation = /[?!.]$/.test(questionContent.trim()) 
    ? questionContent.trim() 
    : `${questionContent.trim()}?`;

  const handleNativeShare = useCallback(async () => {
    if (!shareUrl || typeof navigator.share !== 'function') return;
    
    try {
      await navigator.share({
        title: 'Do you agree?',
        text: `${questionWithPunctuation} Vote here:`,
        url: shareUrl,
      });
    } catch (err) {
      // User cancelled or share failed - that's okay
      if ((err as Error).name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    }
  }, [shareUrl, questionWithPunctuation]);

  const voteColor = userVote === 'YES' 
    ? 'text-emerald-600 dark:text-emerald-400' 
    : userVote === 'NO' 
    ? 'text-rose-600 dark:text-rose-400' 
    : 'text-amber-600 dark:text-amber-400';

  const voteBgColor = userVote === 'YES' 
    ? 'bg-emerald-50 dark:bg-emerald-950/30' 
    : userVote === 'NO' 
    ? 'bg-rose-50 dark:bg-rose-950/30' 
    : 'bg-amber-50 dark:bg-amber-950/30';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <div className="rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {isAuthor ? 'Share Your Question' : 'Challenge a Friend'}
                </h2>
                <p className="text-sm text-zinc-500">
                  {isAuthor ? 'See how friends vote' : 'Find out if they agree'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Question Preview */}
          <div className={cn(
            "rounded-xl p-4 mb-4",
            voteBgColor
          )}>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2 line-clamp-3">
              &ldquo;{questionContent}&rdquo;
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">You voted</span>
              <span className={cn("text-sm font-semibold", voteColor)}>
                {userVote === 'YES' ? 'Yes' : userVote === 'NO' ? 'No' : 'Not Sure'}
              </span>
            </div>
          </div>

          {/* The Hook */}
          <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30">
            <Sparkles className="h-4 w-4 text-violet-500 flex-shrink-0" />
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              When they vote, you&apos;ll both see if you <span className="font-semibold text-emerald-600 dark:text-emerald-400">agree</span> or <span className="font-semibold text-rose-600 dark:text-rose-400">disagree</span>!
            </p>
          </div>

          {/* Share Actions */}
          {error ? (
            <div className="text-center py-4">
              <p className="text-sm text-rose-600 dark:text-rose-400 mb-2">{error}</p>
              <Button size="sm" variant="outline" onClick={createShareChallenge}>
                Try Again
              </Button>
            </div>
          ) : isCreating ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            </div>
          ) : shareCode ? (
            <div className="space-y-3">
              {/* Copy Link */}
              <div className="flex gap-2">
                <div className="flex-1 min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
                    {shareUrl}
                  </p>
                </div>
                <Button
                  onClick={copyToClipboard}
                  className={cn(
                    "gap-2 transition-all",
                    copied 
                      ? "bg-emerald-500 hover:bg-emerald-600" 
                      : "bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900"
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>

              {/* Native Share (mobile) */}
              {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                <Button
                  onClick={handleNativeShare}
                  className="w-full gap-2 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600"
                >
                  <Share2 className="h-4 w-4" />
                  Share with Friends
                </Button>
              )}

              {/* Messaging Apps Quick Share */}
              <div className="flex gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${questionWithPunctuation} Vote here: ${shareUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#20BD5A] transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
                <a
                  href={`sms:?body=${encodeURIComponent(`${questionWithPunctuation} Vote here: ${shareUrl}`)}`}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  iMessage
                </a>
              </div>
            </div>
          ) : null}

          {/* Close hint */}
          <p className="text-center text-xs text-zinc-400 mt-4">
            You&apos;ll get notified when someone votes
          </p>
        </div>
      </div>
    </div>
  );
}

