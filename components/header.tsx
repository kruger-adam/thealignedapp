'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogIn, Home } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

export function Header() {
  const { user, profile, loading, signInWithGoogle } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image 
            src="/logo.png" 
            alt="YesNoNotSure" 
            width={36} 
            height={36}
            className="h-9 w-9"
          />
          <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            YesNoNotSure
          </span>
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
            <Link href={`/profile/${user.id}`} className="ml-2">
              <Avatar
                src={profile?.avatar_url}
                fallback={profile?.username || user.email || ''}
                size="sm"
                className="cursor-pointer transition-opacity hover:opacity-80"
              />
            </Link>
          ) : (
            <Button
              onClick={signInWithGoogle}
              size="sm"
              className="ml-2 gap-1.5"
            >
              <LogIn className="h-4 w-4" />
              Sign in
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}


