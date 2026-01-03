'use client';

import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingProgressBarProps {
  currentVotes: number;
  targetVotes: number;
  category: string;
  onDismiss?: () => void;
  isMinimized?: boolean;
}

const MILESTONE_MESSAGES: Record<number, string> = {
  1: "Great start! 🎯",
  3: "You're on a roll! 🔥",
  5: "Halfway there! ⭐",
  7: "Almost there! 💪",
  9: "One more to go! 🚀",
};

export function OnboardingProgressBar({ 
  currentVotes, 
  targetVotes, 
  category,
  onDismiss,
  isMinimized = false,
}: OnboardingProgressBarProps) {
  const [displayVotes, setDisplayVotes] = useState(currentVotes);
  const [showMilestone, setShowMilestone] = useState(false);
  const [milestoneMessage, setMilestoneMessage] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  
  const progress = Math.min((displayVotes / targetVotes) * 100, 100);
  const remaining = Math.max(targetVotes - displayVotes, 0);

  // Animate vote count changes
  useEffect(() => {
    if (currentVotes !== displayVotes) {
      setIsAnimating(true);
      
      // Check for milestone
      if (MILESTONE_MESSAGES[currentVotes]) {
        setMilestoneMessage(MILESTONE_MESSAGES[currentVotes]);
        setShowMilestone(true);
        setTimeout(() => setShowMilestone(false), 2000);
      }
      
      // Animate the number
      const timer = setTimeout(() => {
        setDisplayVotes(currentVotes);
        setIsAnimating(false);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [currentVotes, displayVotes]);

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
        <div className="flex items-center gap-3 px-4 py-3 rounded-full bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 shadow-xl">
          <div className="relative h-8 w-8">
            <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32">
              <circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-zinc-700"
              />
              <circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                stroke="url(#progress-gradient)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${progress * 0.75} 100`}
                className="transition-all duration-500"
              />
              <defs>
                <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#d946ef" />
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
              {displayVotes}
            </span>
          </div>
          <span className="text-sm text-zinc-300">
            <span className={cn("font-semibold transition-all", isAnimating && "text-violet-400 scale-110")}>
              {remaining}
            </span>
            {' '}more to compare with AI
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 safe-area-inset-bottom">
      {/* Milestone popup */}
      <div 
        className={cn(
          "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 transition-all duration-300",
          showMilestone ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        <div className="px-4 py-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium text-sm shadow-lg">
          {milestoneMessage}
        </div>
      </div>

      <div className="bg-gradient-to-t from-zinc-950 via-zinc-950/98 to-zinc-950/90 backdrop-blur-sm border-t border-zinc-800 px-4 py-4">
        <div className="max-w-lg mx-auto">
          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <span className="text-sm text-zinc-300">
                Voting on <span className="font-semibold text-white">{category}</span>
              </span>
            </div>
            {onDismiss && (
              <button 
                onClick={onDismiss}
                className="p-1 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="relative h-3 rounded-full bg-zinc-800 overflow-hidden mb-2">
            <div 
              className={cn(
                "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500 ease-out",
                isAnimating && "animate-pulse"
              )}
              style={{ width: `${progress}%` }}
            />
            {/* Shimmer effect */}
            <div 
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">
              <span className={cn(
                "font-bold text-white transition-all duration-200",
                isAnimating && "text-violet-400 scale-110"
              )}>
                {displayVotes}
              </span>
              /{targetVotes} votes
            </span>
            <span className="text-zinc-500">
              {remaining > 0 ? (
                <>Compare with AI in <span className="text-violet-400 font-medium">{remaining}</span> more</>
              ) : (
                <span className="text-emerald-400 font-medium">Ready! 🎉</span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

