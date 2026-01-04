'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import posthog from 'posthog-js';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Helper to fetch profile using direct fetch (more reliable than Supabase client)
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`;
      
      const response = await fetch(url, {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      });
      
      if (!response.ok) {
        return null;
      }
      
      const profiles = await response.json();
      return profiles[0] || null;
    } catch {
      return null;
    }
  };

  // Helper to recreate a missing profile for an existing auth user
  const recreateProfile = async (authUser: User): Promise<Profile | null> => {
    try {
      console.log('Recreating missing profile for user:', authUser.id);
      
      // Generate a base username from metadata or email
      const baseUsername = authUser.user_metadata?.name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'user';
      
      // Try to insert with the base username first, then fall back to a unique variant
      const tryInsertProfile = async (username: string): Promise<Profile | null> => {
        const profileData = {
          id: authUser.id,
          email: authUser.email!,
          username: username,
          avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture,
        };
        
        console.log('Attempting to insert profile:', JSON.stringify(profileData));
        
        const { data, error } = await supabase
          .from('profiles')
          .upsert(profileData, { onConflict: 'id' })
          .select()
          .single();
        
        if (error) {
          console.error('Insert failed:', error.message, error.code);
          return null;
        }
        
        console.log('Profile recreated successfully:', JSON.stringify(data));
        return data;
      };
      
      // First attempt with base username
      let profile = await tryInsertProfile(baseUsername);
      
      // If failed (likely due to username conflict), try with email prefix
      if (!profile) {
        const emailPrefix = authUser.email?.split('@')[0] || '';
        const uniqueUsername = `${baseUsername} (${emailPrefix})`;
        console.log('Retrying with unique username:', uniqueUsername);
        profile = await tryInsertProfile(uniqueUsername);
      }
      
      // Last resort: append random suffix
      if (!profile) {
        const randomSuffix = Math.random().toString(36).substring(2, 6);
        const fallbackUsername = `${baseUsername}_${randomSuffix}`;
        console.log('Retrying with fallback username:', fallbackUsername);
        profile = await tryInsertProfile(fallbackUsername);
      }
      
      return profile;
    } catch (err) {
      console.error('Error recreating profile:', err);
      return null;
    }
  };

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          let profile = await fetchProfile(user.id);
          
          // If user exists in auth but profile doesn't exist in DB,
          // try to recreate the profile (user was "soft deleted")
          if (!profile) {
            console.warn('User profile not found - attempting to recreate');
            profile = await recreateProfile(user);
            
            // If recreation also failed, sign out as last resort
            if (!profile) {
              console.error('Failed to recreate profile - signing out');
              await supabase.auth.signOut();
              posthog.reset();
              setUser(null);
              setProfile(null);
              setLoading(false);
              return;
            }
          }
          
          setUser(user);
          setProfile(profile);
          
          // Identify user in PostHog for session replay filtering
          posthog.identify(user.id, {
            email: user.email,
            name: profile.username,
          });
        }
      } catch {
        // Auth error - user not logged in
      }
      
      setLoading(false);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          let profile = await fetchProfile(session.user.id);
          
          // If user exists in auth but profile doesn't exist in DB,
          // try to recreate the profile (user was "soft deleted")
          if (!profile) {
            console.warn('User profile not found - attempting to recreate');
            profile = await recreateProfile(session.user);
            
            // If recreation also failed, sign out as last resort
            if (!profile) {
              console.error('Failed to recreate profile - signing out');
              await supabase.auth.signOut();
              posthog.reset();
              setUser(null);
              setProfile(null);
              setLoading(false);
              return;
            }
          }
          
          setUser(session.user);
          setProfile(profile);
          
          // Identify user in PostHog for session replay filtering
          posthog.identify(session.user.id, {
            email: session.user.email,
            name: profile.username,
          });
        } else {
          setUser(null);
          setProfile(null);
          posthog.reset();
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    posthog.reset(); // Clear PostHog identity
    setUser(null);
    setProfile(null);
    // Redirect to landing page
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


