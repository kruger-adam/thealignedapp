'use client';

import { useState, useEffect } from 'react';
import { Bot, X } from 'lucide-react';
import { useAIAssistant } from './ai-assistant-provider';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

const PROACTIVE_BUBBLE_STORAGE_KEY = 'ai-proactive-bubble-seen';

export function AIAssistantFAB() {
  const { user } = useAuth();
  const { isOpen, isClosing, openAssistantWithPrompt, toggleAssistant } = useAIAssistant();
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleVisible, setBubbleVisible] = useState(false);

  // Check if user has seen the proactive bubble before
  useEffect(() => {
    if (!user) return;
    
    // Small delay before showing bubble for better UX
    const timer = setTimeout(() => {
      try {
        const seen = localStorage.getItem(PROACTIVE_BUBBLE_STORAGE_KEY);
        if (!seen) {
          setShowBubble(true);
          // Animate in after a brief moment
          setTimeout(() => setBubbleVisible(true), 100);
        }
      } catch {
        // localStorage not available
      }
    }, 2000); // Show after 2 seconds on page

    return () => clearTimeout(timer);
  }, [user]);

  // Hide bubble when assistant opens
  useEffect(() => {
    if (isOpen) {
      setShowBubble(false);
      setBubbleVisible(false);
    }
  }, [isOpen]);

  const handleBubbleClick = () => {
    // Mark as seen
    try {
      localStorage.setItem(PROACTIVE_BUBBLE_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
    
    setShowBubble(false);
    setBubbleVisible(false);
    
    // Open assistant with the poll creation prompt
    openAssistantWithPrompt('poll-creation');
  };

  const dismissBubble = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Mark as seen
    try {
      localStorage.setItem(PROACTIVE_BUBBLE_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
    setBubbleVisible(false);
    setTimeout(() => setShowBubble(false), 300);
  };

  // Don't show FAB for logged-out users
  if (!user) return null;

  // Show as "open" while closing animation plays
  const showAsOpen = isOpen || isClosing;

  return (
    <>
      {/* Proactive message bubble */}
      {showBubble && !showAsOpen && (
        <div
          className={cn(
            'fixed bottom-24 right-6 z-[60] max-w-[280px] cursor-pointer',
            'transition-all duration-300 ease-out',
            bubbleVisible 
              ? 'opacity-100 translate-y-0 scale-100' 
              : 'opacity-0 translate-y-4 scale-95'
          )}
          onClick={handleBubbleClick}
        >
          <div className="relative rounded-2xl bg-white px-4 py-3 shadow-xl ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10">
            {/* Close button */}
            <button
              onClick={dismissBubble}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-zinc-500 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            
            {/* Message */}
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Hello! 👋
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              What&apos;s a hobby or interest of yours? I&apos;ll create a poll that might interest you!
            </p>
            
            {/* Speech bubble tail */}
            <div className="absolute -bottom-2 right-6 h-4 w-4 rotate-45 bg-white shadow-xl dark:bg-zinc-800" />
          </div>
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={toggleAssistant}
        className={cn(
          'fixed bottom-6 right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300',
          'bg-gradient-to-br from-violet-500 to-indigo-600 text-white',
          'hover:from-violet-600 hover:to-indigo-700 hover:shadow-xl hover:scale-105',
          'active:scale-95',
          'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2',
          // Adjust position when panel is open on desktop
          'lg:bottom-6 lg:right-6',
          showAsOpen && 'lg:right-[calc(420px+1.5rem)]',
          // Genie "pull" effect - scale down slightly when opening
          showAsOpen && !isClosing && 'scale-90',
          // Genie "push" effect - scale up when closing (the panel is returning to this point)
          isClosing && 'scale-110'
        )}
        aria-label={showAsOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
      >
        <div className={cn(
          'transition-transform duration-300',
          showAsOpen && 'rotate-180'
        )}>
          {showAsOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Bot className="h-6 w-6" />
          )}
        </div>
        
        {/* Pulse animation when closed */}
        {!showAsOpen && (
          <span className="absolute inset-0 animate-ping rounded-full bg-violet-400 opacity-20" />
        )}
        
        {/* Glow effect when closing (panel collapsing into FAB) */}
        {isClosing && (
          <span className="absolute inset-0 animate-pulse rounded-full bg-violet-300 opacity-40" />
        )}
      </button>
    </>
  );
}

