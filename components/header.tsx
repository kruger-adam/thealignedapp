'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogIn, Home, ExternalLink, Flame, Snowflake } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { NotificationsDropdown } from '@/components/notifications-dropdown';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

// Detect in-app browsers (Facebook, Messenger, Instagram, etc.)
function isInAppBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || '';
  // Check for common in-app browser signatures
  return /FBAN|FBAV|Instagram|Messenger|LinkedIn|Twitter|MicroMessenger|Line|WhatsApp/i.test(ua);
}

// Helper to check if a streak is still valid based on last vote date
function isStreakValid(lastVoteDate: string | null | undefined): boolean {
  if (!lastVoteDate) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const lastVote = new Date(lastVoteDate + 'T00:00:00');
  
  // Streak is valid if last vote was today or yesterday
  return lastVote >= yesterday;
}

// Streak indicator component
function StreakIndicator({ streak, lastVoteDate }: { streak: number; lastVoteDate: string | null | undefined }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        tooltipRef.current &&
        buttonRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setShowTooltip(false);
      }
    };

    if (showTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTooltip]);

  // Check if streak is actually valid (user voted today or yesterday)
  const hasStreak = streak > 0 && isStreakValid(lastVoteDate);

  if (hasStreak) {
    // Active streak - show flame with count
    return (
      <Link
        href={`#`}
        onClick={(e) => e.preventDefault()}
        className="relative flex items-center gap-0.5 rounded-full bg-gradient-to-r from-orange-100 to-amber-100 px-2 py-1 transition-all hover:from-orange-200 hover:to-amber-200 dark:from-orange-900/40 dark:to-amber-900/40 dark:hover:from-orange-900/60 dark:hover:to-amber-900/60"
        title={`${streak} day voting streak!`}
      >
        <Flame className="h-4 w-4 text-orange-500 animate-flame-flicker" />
        <span className="text-sm font-bold text-orange-600 dark:text-orange-400 tabular-nums">
          {streak}
        </span>
        {/* Glow effect for high streaks */}
        {streak >= 7 && (
          <div className="absolute inset-0 -z-10 animate-pulse rounded-full bg-orange-400/20 blur-md" />
        )}
      </Link>
    );
  }

  // No streak - show icy indicator with tooltip
  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setShowTooltip(!showTooltip)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="group flex items-center rounded-full bg-gradient-to-r from-sky-100 to-blue-100 p-1.5 transition-all hover:from-sky-200 hover:to-blue-200 dark:from-sky-900/40 dark:to-blue-900/40 dark:hover:from-sky-900/60 dark:hover:to-blue-900/60"
        aria-label="Start a voting streak"
      >
        <Snowflake className="h-4 w-4 text-sky-500 transition-transform group-hover:rotate-45 group-hover:scale-110" />
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div
          ref={tooltipRef}
          className="absolute right-0 top-full z-50 mt-2 w-56 animate-in slide-in-from-top-2"
        >
          <div className="rounded-xl border border-sky-200 bg-white p-3 shadow-lg dark:border-sky-800 dark:bg-zinc-900">
            <div className="flex items-start gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-blue-100 dark:from-sky-900/50 dark:to-blue-900/50">
                <Snowflake className="h-4 w-4 text-sky-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  No streak yet!
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Vote on a question today to ignite your streak 🔥
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 p-2 dark:from-orange-950/30 dark:to-amber-950/30">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-xs text-orange-700 dark:text-orange-300">
                Daily votes = daily streak!
              </span>
            </div>
          </div>
          {/* Arrow */}
          <div className="absolute -top-1.5 right-4 h-3 w-3 rotate-45 border-l border-t border-sky-200 bg-white dark:border-sky-800 dark:bg-zinc-900" />
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { user, profile, loading, signInWithGoogle } = useAuth();
  const pathname = usePathname();
  const [showInAppWarning, setShowInAppWarning] = useState(false);
  const [isInApp, setIsInApp] = useState(false);

  useEffect(() => {
    setIsInApp(isInAppBrowser());
  }, []);

  // Don't show main header for logged-out users (landing page has its own)
  if (!loading && !user) {
    return null;
  }

  const handleSignIn = () => {
    if (isInApp) {
      setShowInAppWarning(true);
    } else {
      signInWithGoogle();
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center active:scale-95 transition-transform">
          <Image 
            src="/logo-transparent.png" 
            alt="Aligned" 
            width={36} 
            height={36}
            className="h-9 w-9"
          />
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          <Link href="/">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'gap-1.5',
                pathname === '/' && 'bg-zinc-100 dark:bg-zinc-800'
              )}
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Feed</span>
            </Button>
          </Link>

          {loading ? (
            <div className="ml-2 h-8 w-8 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
          ) : user ? (
            <>
              <StreakIndicator streak={profile?.vote_streak ?? 0} lastVoteDate={profile?.last_vote_date} />
              <NotificationsDropdown />
              <Link href={`/profile/${user.id}`} className="ml-1">
                <Avatar
                  src={profile?.avatar_url}
                  fallback={profile?.username || user.email || ''}
                  size="sm"
                  className="cursor-pointer transition-all hover:opacity-80 active:scale-95"
                />
              </Link>
            </>
          ) : (
            <Button
              onClick={handleSignIn}
              size="sm"
              className="ml-2 gap-1.5"
            >
              <LogIn className="h-4 w-4" />
              Sign in
            </Button>
          )}
        </nav>
      </div>

      {/* In-app browser warning modal */}
      {showInAppWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Open in Browser
            </h2>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              Google Sign-In doesn&apos;t work in this browser. Please open this page in Safari or Chrome:
            </p>
            <ol className="mb-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium dark:bg-zinc-700">1</span>
                <span>Tap the <strong>⋯</strong> or <strong>Share</strong> button</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium dark:bg-zinc-700">2</span>
                <span>Select <strong>&quot;Open in Safari&quot;</strong> or <strong>&quot;Open in Browser&quot;</strong></span>
              </li>
            </ol>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInAppWarning(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  setShowInAppWarning(false);
                }}
                className="flex-1 gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Copy Link
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}


