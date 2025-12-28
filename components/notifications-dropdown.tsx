'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Bell, Settings, ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';
import { Notification } from '@/lib/types';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface NotificationPreferences {
  mention: boolean;
  follow: boolean;
  follow_activity: boolean;
  new_question: boolean;
  vote_on_your_question: boolean;
  comment_on_your_question: boolean;
}

const defaultPreferences: NotificationPreferences = {
  mention: true,
  follow: true,
  follow_activity: true,
  new_question: true,
  vote_on_your_question: true,
  comment_on_your_question: true,
};

const preferenceLabels: Record<keyof NotificationPreferences, { label: string; description: string }> = {
  mention: { label: 'Mentions', description: 'When someone @mentions you in a comment' },
  follow: { label: 'New followers', description: 'When someone starts following you' },
  follow_activity: { label: 'Following activity', description: 'When people you follow vote, comment, or follow others' },
  new_question: { label: 'New questions', description: 'When people you follow post new questions' },
  vote_on_your_question: { label: 'Votes on your questions', description: 'When someone votes on your question' },
  comment_on_your_question: { label: 'Comments on your questions', description: 'When someone comments on your question' },
};

// Map a notification to its preference key
function getPreferenceKey(notification: Notification, userId: string): keyof NotificationPreferences {
  switch (notification.type) {
    case 'mention':
      return 'mention';
    case 'follow':
      // If has related_user, it's "X followed Y" (follow activity)
      // Otherwise it's "X followed you"
      return notification.related_user_id ? 'follow_activity' : 'follow';
    case 'new_question':
      return 'new_question';
    case 'vote':
      // If the question's author is you, it's about your question
      // Otherwise it's follow activity
      if (notification.question?.author_id === userId) {
        return 'vote_on_your_question';
      }
      return 'follow_activity';
    case 'comment':
      // Same logic as vote
      if (notification.question?.author_id === userId) {
        return 'comment_on_your_question';
      }
      return 'follow_activity';
    default:
      return 'mention'; // Fallback
  }
}

export function NotificationsDropdown() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Filter notifications based on user preferences
  const filteredNotifications = useMemo(() => {
    if (!user) return notifications;
    return notifications.filter(n => {
      const prefKey = getPreferenceKey(n, user.id);
      return preferences[prefKey];
    });
  }, [notifications, preferences, user]);
  
  // Filtered unread count
  const filteredUnreadCount = useMemo(() => {
    return filteredNotifications.filter(n => !n.read).length;
  }, [filteredNotifications]);

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
        // Get unique IDs
        const actorIds = [...new Set(notificationsData.map((n) => n.actor_id))];
        const questionIds = [...new Set(notificationsData.filter((n) => n.question_id).map((n) => n.question_id))];
        const relatedUserIds = [...new Set(notificationsData.filter((n) => n.related_user_id).map((n) => n.related_user_id))];
        
        // Combine all user IDs to fetch
        const allUserIds = [...new Set([...actorIds, ...relatedUserIds])];
        
        // Fetch all profiles at once
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id,username,avatar_url')
          .in('id', allUserIds);
        
        const profileMap = Object.fromEntries(
          (profiles || []).map((p: { id: string; username: string | null; avatar_url: string | null }) => [p.id, p])
        );
        
        // Fetch questions if any (including author_id for preference filtering)
        let questionMap: Record<string, { content: string; author_id: string }> = {};
        if (questionIds.length > 0) {
          const { data: questions } = await supabase
            .from('questions')
            .select('id,content,author_id')
            .in('id', questionIds);
          
          questionMap = Object.fromEntries(
            (questions || []).map((q: { id: string; content: string; author_id: string }) => [q.id, { content: q.content, author_id: q.author_id }])
          );
        }
        
        // Combine data
        const enrichedNotifications: Notification[] = notificationsData.map((n: Notification) => ({
          ...n,
          actor: profileMap[n.actor_id] || { username: 'Someone', avatar_url: null },
          question: n.question_id ? questionMap[n.question_id] : undefined,
          related_user: n.related_user_id ? profileMap[n.related_user_id] : undefined,
        }));
        
        setNotifications(enrichedNotifications);
      } else {
        setNotifications([]);
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
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  // Fetch notification preferences
  const fetchPreferences = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', user.id)
        .single();
      
      if (profile?.notification_preferences) {
        setPreferences({ ...defaultPreferences, ...profile.notification_preferences });
      }
    } catch (err) {
      console.error('Error fetching preferences:', err);
    }
  }, [user, supabase]);

  // Save notification preferences
  const savePreferences = async (newPreferences: NotificationPreferences) => {
    if (!user) return;
    
    setSavingPreferences(true);
    try {
      await supabase
        .from('profiles')
        .update({ notification_preferences: newPreferences })
        .eq('id', user.id);
      
      setPreferences(newPreferences);
    } catch (err) {
      console.error('Error saving preferences:', err);
    }
    setSavingPreferences(false);
  };

  // Toggle a preference
  const togglePreference = (key: keyof NotificationPreferences) => {
    const newPreferences = { ...preferences, [key]: !preferences[key] };
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };

  // Fetch on mount and when user changes
  useEffect(() => {
    fetchNotifications();
    fetchPreferences();
  }, [user, fetchPreferences]);

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
        if (notification.related_user) {
          // Someone you follow followed someone else
          return (
            <>
              <span className="font-medium">{actorName}</span>
              {' started following '}
              <span className="font-medium">{notification.related_user.username || 'someone'}</span>
            </>
          );
        }
        // Someone followed you directly
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
        {filteredUnreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
            {filteredUnreadCount > 9 ? '9+' : filteredUnreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800 z-50">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
            {showSettings ? (
              <>
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Settings</h3>
                <div className="w-12" /> {/* Spacer for centering */}
              </>
            ) : (
              <>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Notifications</h3>
                <div className="flex items-center gap-2">
                  {filteredUnreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      Mark all as read
                    </button>
                  )}
                  <button
                    onClick={() => setShowSettings(true)}
                    className="p-1 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    title="Notification settings"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Settings View */}
          {showSettings ? (
            <div className="max-h-96 overflow-y-auto p-4">
              <p className="mb-4 text-sm text-zinc-500">
                Choose which notifications you want to receive
              </p>
              <div className="space-y-3">
                {(Object.keys(preferenceLabels) as Array<keyof NotificationPreferences>).map((key) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-start gap-3"
                  >
                    <div className="relative mt-0.5">
                      <input
                        type="checkbox"
                        checked={preferences[key]}
                        onChange={() => togglePreference(key)}
                        className="sr-only"
                        disabled={savingPreferences}
                      />
                      <div
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded border-2 transition-colors",
                          preferences[key]
                            ? "border-blue-600 bg-blue-600"
                            : "border-zinc-300 dark:border-zinc-600"
                        )}
                      >
                        {preferences[key] && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {preferenceLabels[key].label}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {preferenceLabels[key].description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ) : (
          /* Notifications List */
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500">
                No notifications yet
              </div>
            ) : (
              filteredNotifications.map((notification) => (
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
          )}
        </div>
      )}
    </div>
  );
}

