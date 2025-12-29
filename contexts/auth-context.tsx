'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
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
    console.log(`[Auth] Fetching profile via direct fetch for user:`, userId);
    
    try {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`;
      
      const response = await fetch(url, {
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      });
      
      if (!response.ok) {
        console.error(`[Auth] Profile fetch failed:`, response.status, response.statusText);
        return null;
      }
      
      const profiles = await response.json();
      const profile = profiles[0] || null;
      
      console.log(`[Auth] Profile fetched successfully:`, profile?.username);
      return profile;
    } catch (err) {
      console.error(`[Auth] Profile fetch threw:`, err);
      return null;
    }
  };

  useEffect(() => {
    const getUser = async () => {
      console.log('[Auth] getUser starting...');
      try {
        console.log('[Auth] Calling supabase.auth.getUser()...');
        const { data: { user } } = await supabase.auth.getUser();
        console.log('[Auth] getUser result:', user ? user.email : 'null');
        setUser(user);
        
        if (user) {
          console.log('[Auth] User found, fetching profile...');
          const profile = await fetchProfile(user.id);
          console.log('[Auth] Profile result:', profile ? profile.username : 'null');
          setProfile(profile);
        } else {
          console.log('[Auth] No user, skipping profile fetch');
        }
      } catch (err) {
        console.error('[Auth] Error getting user:', err);
      }
      
      console.log('[Auth] Setting loading to false');
      setLoading(false);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          setProfile(profile);
        } else {
          setProfile(null);
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
    setUser(null);
    setProfile(null);
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


