'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';
import { Mail, Bell, ArrowLeft, Check, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface EmailPreferences {
  email_mention: boolean;
  email_comment: boolean;
}

const defaultPreferences: EmailPreferences = {
  email_mention: true,
  email_comment: true,
};

export default function EmailPreferencesPage() {
  const { user, loading: authLoading } = useAuth();
  const [preferences, setPreferences] = useState<EmailPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (user) {
      fetchPreferences();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  const fetchPreferences = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', user!.id)
        .single();

      if (profile?.notification_preferences) {
        const prefs = profile.notification_preferences as Record<string, boolean>;
        setPreferences({
          email_mention: prefs.email_mention ?? defaultPreferences.email_mention,
          email_comment: prefs.email_comment ?? defaultPreferences.email_comment,
        });
      }
    } catch (err) {
      console.error('Error fetching preferences:', err);
    }
    setLoading(false);
  };

  const updatePreference = async (key: keyof EmailPreferences, value: boolean) => {
    if (!user) return;

    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    setSaving(true);
    setSaved(false);

    try {
      // Get current notification_preferences
      const { data: profile } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', user.id)
        .single();

      const currentPrefs = (profile?.notification_preferences as Record<string, boolean>) || {};
      
      // Merge email preferences
      const updatedPrefs = {
        ...currentPrefs,
        [key]: value,
      };

      await supabase
        .from('profiles')
        .update({ notification_preferences: updatedPrefs })
        .eq('id', user.id);

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Error saving preferences:', err);
      // Revert on error
      setPreferences(preferences);
    }
    setSaving(false);
  };

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-12">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-12">
        <div className="mx-auto max-w-md">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <Mail className="mx-auto h-12 w-12 text-zinc-500 mb-4" />
            <h1 className="text-xl font-semibold text-zinc-100 mb-2">
              Email Preferences
            </h1>
            <p className="text-zinc-400 mb-6">
              Please sign in to manage your email notification preferences.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              Go to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12">
      <div className="mx-auto max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="border-b border-zinc-800 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                <Mail className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-zinc-100">
                  Email Preferences
                </h1>
                <p className="text-sm text-zinc-400">
                  Choose which emails you&apos;d like to receive
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Mention emails */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                  <Bell className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-zinc-200">Mentions</p>
                  <p className="text-sm text-zinc-500">
                    Get notified when someone @mentions you in a comment
                  </p>
                </div>
              </div>
              <button
                onClick={() => updatePreference('email_mention', !preferences.email_mention)}
                disabled={saving}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  preferences.email_mention
                    ? 'bg-emerald-500'
                    : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    preferences.email_mention ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Comment emails */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                  <Bell className="h-4 w-4 text-violet-400" />
                </div>
                <div>
                  <p className="font-medium text-zinc-200">Comments on your polls</p>
                  <p className="text-sm text-zinc-500">
                    Get notified when someone comments on a poll you created
                  </p>
                </div>
              </div>
              <button
                onClick={() => updatePreference('email_comment', !preferences.email_comment)}
                disabled={saving}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  preferences.email_comment
                    ? 'bg-emerald-500'
                    : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    preferences.email_comment ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Save indicator */}
          <div className="border-t border-zinc-800 px-6 py-3 flex items-center justify-end gap-2">
            {saving && (
              <span className="flex items-center gap-2 text-sm text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </span>
            )}
            {saved && (
              <span className="flex items-center gap-2 text-sm text-emerald-400">
                <Check className="h-4 w-4" />
                Saved
              </span>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          These settings only affect email notifications.
          <br />
          In-app notifications can be managed from the notification bell.
        </p>
      </div>
    </main>
  );
}

