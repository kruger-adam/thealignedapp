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

  // Helper to fetch profile with retry logic and timeout
  const fetchProfile = async (userId: string, retries = 3): Promise<Profile | null> => {
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`[Auth] Fetching profile attempt ${i + 1} for user:`, userId);
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
        );
        
        const fetchPromise = supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        const result = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (!result || 'error' in result === false) {
          console.error(`[Auth] Profile fetch attempt ${i + 1} timed out`);
          if (i < retries - 1) {
            await new Promise(r => setTimeout(r, 500 * (i + 1)));
            continue;
          }
          return null;
        }
        
        const { data: profile, error } = result;
        
        if (error) {
          console.error(`[Auth] Profile fetch attempt ${i + 1} failed:`, error);
          if (i < retries - 1) {
            await new Promise(r => setTimeout(r, 500 * (i + 1)));
            continue;
          }
          return null;
        }
        
        console.log(`[Auth] Profile fetched successfully:`, profile?.username);
        return profile;
      } catch (err) {
        console.error(`[Auth] Profile fetch attempt ${i + 1} threw:`, err);
        if (i < retries - 1) {
          await new Promise(r => setTimeout(r, 500 * (i + 1)));
        }
      }
    }
    console.error('[Auth] All profile fetch attempts failed');
    return null;
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


