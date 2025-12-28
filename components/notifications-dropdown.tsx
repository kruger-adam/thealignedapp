'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';
import { Notification } from '@/lib/types';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function NotificationsDropdown() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch notifications using Supabase client (handles auth properly)
      const { data: notificationsData, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) {
        console.error('Error fetching notifications:', error);
        setLoading(false);
        return;
      }
      
      if (notificationsData && notificationsData.length > 0) {
        // Get unique actor IDs and question IDs
        const actorIds = [...new Set(notificationsData.map((n) => n.actor_id))];
        const questionIds = [...new Set(notificationsData.filter((n) => n.question_id).map((n) => n.question_id))];
        
        // Fetch actor profiles
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id,username,avatar_url')
          .in('id', actorIds);
        
        const profileMap = Object.fromEntries(
          (profiles || []).map((p: { id: string; username: string | null; avatar_url: string | null }) => [p.id, p])
        );
        
        // Fetch questions if any
        let questionMap: Record<string, { content: string }> = {};
        if (questionIds.length > 0) {
          const { data: questions } = await supabase
            .from('questions')
            .select('id,content')
            .in('id', questionIds);
          
          questionMap = Object.fromEntries(
            (questions || []).map((q: { id: string; content: string }) => [q.id, { content: q.content }])
          );
        }
        
        // Combine data
        const enrichedNotifications: Notification[] = notificationsData.map((n: Notification) => ({
          ...n,
          actor: profileMap[n.actor_id] || { username: 'Someone', avatar_url: null },
          question: n.question_id ? questionMap[n.question_id] : undefined,
        }));
        
        setNotifications(enrichedNotifications);
        setUnreadCount(enrichedNotifications.filter((n: Notification) => !n.read).length);
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
    setLoading(false);
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);
      
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!user) return;
    
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  // Fetch on mount and when user changes
  useEffect(() => {
    fetchNotifications();
  }, [user]);

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Refetch notifications when a new one arrives
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get notification message
  const getNotificationMessage = (notification: Notification) => {
    const actorName = notification.actor?.username || 'Someone';
    
    switch (notification.type) {
      case 'mention':
        return (
          <>
            <span className="font-medium">{actorName}</span>
            {' mentioned you in a comment'}
          </>
        );
      case 'follow':
        return (
          <>
            <span className="font-medium">{actorName}</span>
            {' started following you'}
          </>
        );
      case 'new_question':
        return (
          <>
            <span className="font-medium">{actorName}</span>
            {' posted a new question'}
          </>
        );
      case 'vote':
        return (
          <>
            <span className="font-medium">{actorName}</span>
            {' voted on a question'}
          </>
        );
      case 'comment':
        return (
          <>
            <span className="font-medium">{actorName}</span>
            {' commented on a question'}
          </>
        );
      default:
        return 'New notification';
    }
  };

  // Format time ago
  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(date).toLocaleDateString();
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800 z-50">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500">
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.question_id ? `/question/${notification.question_id}` : '/'}
                  onClick={() => {
                    if (!notification.read) markAsRead(notification.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors",
                    !notification.read && "bg-blue-50 dark:bg-blue-900/20"
                  )}
                >
                  <Avatar
                    src={notification.actor?.avatar_url}
                    fallback={notification.actor?.username || 'U'}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      {getNotificationMessage(notification)}
                    </p>
                    {notification.question && (
                      <p className="mt-0.5 text-xs text-zinc-500 truncate">
                        &quot;{notification.question.content}&quot;
                      </p>
                    )}
                    <p className="mt-1 text-xs text-zinc-400">
                      {timeAgo(notification.created_at)}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="h-2 w-2 rounded-full bg-blue-500 mt-2" />
                  )}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

