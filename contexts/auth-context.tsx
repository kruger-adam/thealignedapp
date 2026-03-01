'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import posthog from 'posthog-js';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
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
  // Uses REST API directly with access token for reliable auth
  const recreateProfile = async (authUser: User, accessToken: string): Promise<Profile | null> => {
    console.log('Recreating missing profile for user:', authUser.id);
    console.log('Access token available:', !!accessToken);
    
    if (!accessToken) {
      console.error('No access token provided for profile creation');
      return null;
    }
    
    // Generate a base username from metadata or email
    const baseUsername = authUser.user_metadata?.name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'user';
    console.log('Base username:', baseUsername);
    
    // Try to insert with the base username first, then fall back to unique variants
    const tryInsertProfile = async (username: string): Promise<Profile | null> => {
      const profileData = {
        id: authUser.id,
        email: authUser.email!,
        username: username,
        avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture,
      };
      
      console.log('Attempting to insert profile via REST:', JSON.stringify(profileData));
      
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              'Authorization': `Bearer ${accessToken}`,
              'Prefer': 'return=representation',
            },
            body: JSON.stringify(profileData),
          }
        );
        
        console.log('REST response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('REST insert failed:', response.status, errorText);
          return null;
        }
        
        const data = await response.json();
        console.log('Profile recreated successfully:', JSON.stringify(data));
        return Array.isArray(data) ? data[0] : data;
      } catch (fetchErr) {
        console.error('Fetch error:', fetchErr);
        return null;
      }
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
  };

  useEffect(() => {
    const getUser = async () => {
      try {
        // Get both user and session together
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        
        if (user && session?.access_token) {
          let profile = await fetchProfile(user.id);
          
          // If user exists in auth but profile doesn't exist in DB,
          // try to recreate the profile (user was "soft deleted")
          if (!profile) {
            console.warn('User profile not found - attempting to recreate');
            profile = await recreateProfile(user, session.access_token);
            
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
        console.log('Auth state change:', event, !!session);
        
        if (session?.user && session?.access_token) {
          let profile = await fetchProfile(session.user.id);
          
          // If user exists in auth but profile doesn't exist in DB,
          // try to recreate the profile (user was "soft deleted")
          if (!profile) {
            console.warn('User profile not found - attempting to recreate');
            profile = await recreateProfile(session.user, session.access_token);
            
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
    const currentPath = window.location.pathname + window.location.search;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(currentPath)}`,
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

  const refreshProfile = async () => {
    if (user) {
      const updatedProfile = await fetchProfile(user.id);
      if (updatedProfile) {
        setProfile(updatedProfile);
      }
    }
  };

  // Show loading splash screen while auth is initializing
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/logo-transparent.png"
            alt="Aligned"
            width={80}
            height={80}
            className="animate-logo-pulse"
            priority
          />
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle, signOut, refreshProfile }}>
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


