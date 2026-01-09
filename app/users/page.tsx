'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Loader2, UserPlus, UserMinus, ChevronDown, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';

interface User {
  id: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
  follower_count: number;
  vote_count: number;
  is_following: boolean;
  is_current_user: boolean;
}

type SortOption = 'newest' | 'most_followers' | 'most_votes' | 'alphabetical';

const PAGE_SIZE = 20;

export default function UsersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>('most_followers');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [followingStates, setFollowingStates] = useState<Record<string, boolean>>({});
  const [followLoadingStates, setFollowLoadingStates] = useState<Record<string, boolean>>({});
  
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'most_followers', label: 'Most Followers' },
    { value: 'most_votes', label: 'Most Votes' },
    { value: 'newest', label: 'Newest Members' },
    { value: 'alphabetical', label: 'A-Z' },
  ];

  // Close sort dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUsers = useCallback(async (append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setOffset(0);
      setHasMore(true);
    }

    const currentOffset = append ? offset : 0;

    try {
      const res = await fetch(
        `/api/users?limit=${PAGE_SIZE}&offset=${currentOffset}&sort=${sortBy}`
      );
      const data = await res.json();

      if (data.error) {
        console.error('Error fetching users:', data.error);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const newUsers = data.users || [];
      
      // Initialize following states
      const newFollowingStates: Record<string, boolean> = {};
      newUsers.forEach((u: User) => {
        newFollowingStates[u.id] = u.is_following;
      });

      if (append) {
        setUsers(prev => [...prev, ...newUsers]);
        setFollowingStates(prev => ({ ...prev, ...newFollowingStates }));
        setOffset(currentOffset + newUsers.length);
      } else {
        setUsers(newUsers);
        setFollowingStates(newFollowingStates);
        setOffset(newUsers.length);
      }

      setHasMore(data.hasMore);
    } catch (err) {
      console.error('Fetch error:', err);
    }

    setLoading(false);
    setLoadingMore(false);
  }, [offset, sortBy]);

  // Fetch when sort changes
  useEffect(() => {
    fetchUsers(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy]);

  // Load more on scroll
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      fetchUsers(true);
    }
  }, [loadingMore, hasMore, loading, fetchUsers]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '400px' }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [loadMore]);

  const handleFollow = async (targetUserId: string) => {
    if (!user) {
      router.push('/');
      return;
    }

    setFollowLoadingStates(prev => ({ ...prev, [targetUserId]: true }));

    try {
      const isCurrentlyFollowing = followingStates[targetUserId];

      if (isCurrentlyFollowing) {
        // Unfollow
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);

        setFollowingStates(prev => ({ ...prev, [targetUserId]: false }));
        
        // Update follower count locally
        setUsers(prev => prev.map(u => 
          u.id === targetUserId 
            ? { ...u, follower_count: Math.max(0, u.follower_count - 1) }
            : u
        ));
      } else {
        // Follow
        await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: targetUserId,
          });

        // Create notification
        await supabase.from('notifications').insert({
          user_id: targetUserId,
          type: 'follow',
          actor_id: user.id,
        });

        setFollowingStates(prev => ({ ...prev, [targetUserId]: true }));
        
        // Update follower count locally
        setUsers(prev => prev.map(u => 
          u.id === targetUserId 
            ? { ...u, follower_count: u.follower_count + 1 }
            : u
        ));
      }
    } catch (err) {
      console.error('Error following/unfollowing:', err);
    }

    setFollowLoadingStates(prev => ({ ...prev, [targetUserId]: false }));
  };

  // Redirect to home if not logged in
  if (!authLoading && !user) {
    router.push('/');
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.back()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Discover People
          </h1>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-sm text-zinc-500">
            Find interesting people to follow
          </p>
          <div className="relative" ref={sortDropdownRef}>
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              <span className="hidden sm:inline">Sorted by</span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {sortOptions.find(s => s.value === sortBy)?.label}
              </span>
              <ChevronDown className={`h-3 w-3 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showSortDropdown && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                {sortOptions.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => {
                      setSortBy(value);
                      setShowSortDropdown(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-sm transition-colors ${
                      sortBy === value
                        ? 'bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100'
                        : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-700/50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Users List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      ) : users.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-lg text-zinc-500">No users found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u, index) => (
            <Card
              key={u.id}
              className="animate-in fade-in slide-in-from-bottom-2 p-4"
              style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
            >
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={`/profile/${u.id}`}
                  className="flex items-center gap-3 min-w-0 flex-1"
                >
                  <Avatar
                    src={u.avatar_url}
                    fallback={u.username || 'A'}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {u.username || 'Anonymous'}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {sortBy === 'most_votes' 
                        ? `${u.vote_count} ${u.vote_count === 1 ? 'vote' : 'votes'}`
                        : `${u.follower_count} ${u.follower_count === 1 ? 'follower' : 'followers'}`
                      }
                    </p>
                  </div>
                </Link>

                {!u.is_current_user && (
                  <Button
                    variant={followingStates[u.id] ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => handleFollow(u.id)}
                    disabled={followLoadingStates[u.id]}
                    className="shrink-0 gap-1.5"
                  >
                    {followLoadingStates[u.id] ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : followingStates[u.id] ? (
                      <>
                        <UserMinus className="h-4 w-4" />
                        <span className="hidden sm:inline">Unfollow</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        <span className="hidden sm:inline">Follow</span>
                      </>
                    )}
                  </Button>
                )}

                {u.is_current_user && (
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    You
                  </span>
                )}
              </div>
            </Card>
          ))}

          {/* Infinite scroll trigger */}
          <div ref={loadMoreRef} className="py-4">
            {loadingMore && (
              <div className="flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
              </div>
            )}
            {!hasMore && users.length > 0 && (
              <p className="text-center text-sm text-zinc-400">
                You&apos;ve seen everyone
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

