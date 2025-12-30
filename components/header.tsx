'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogIn, Home, ExternalLink } from 'lucide-react';
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

export function Header() {
  const { user, profile, loading, signInWithGoogle } = useAuth();
  const pathname = usePathname();
  const [showInAppWarning, setShowInAppWarning] = useState(false);
  const [isInApp, setIsInApp] = useState(false);

  useEffect(() => {
    setIsInApp(isInAppBrowser());
  }, []);

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
        <Link href="/" className="flex items-center">
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
              <NotificationsDropdown />
              <Link href={`/profile/${user.id}`} className="ml-1">
                <Avatar
                  src={profile?.avatar_url}
                  fallback={profile?.username || user.email || ''}
                  size="sm"
                  className="cursor-pointer transition-opacity hover:opacity-80"
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


