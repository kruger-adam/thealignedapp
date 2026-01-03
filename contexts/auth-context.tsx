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

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const profile = await fetchProfile(user.id);
          
          // If user exists in auth but profile doesn't exist in DB,
          // the user was deleted - sign them out
          if (!profile) {
            console.warn('User profile not found - signing out deleted user');
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
            setLoading(false);
            return;
          }
          
          setUser(user);
          setProfile(profile);
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
          const profile = await fetchProfile(session.user.id);
          
          // If user exists in auth but profile doesn't exist in DB,
          // the user was deleted - sign them out
          if (!profile) {
            console.warn('User profile not found - signing out deleted user');
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
            setLoading(false);
            return;
          }
          
          setUser(session.user);
          setProfile(profile);
        } else {
          setUser(null);
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


