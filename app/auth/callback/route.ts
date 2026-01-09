import { createClient } from '@/lib/supabase/server';
import { notifyNewSignup } from '@/lib/notifications';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error_param = searchParams.get('error');
  const error_description = searchParams.get('error_description');
  const next = searchParams.get('next') ?? '/';

  // Log for debugging
  console.log('Auth callback received:', {
    hasCode: !!code,
    error: error_param,
    error_description,
    origin,
  });

  // Check for OAuth error from provider
  if (error_param) {
    console.error('OAuth error:', error_param, error_description);
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${error_param}`);
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    console.log('Exchange result:', { 
      success: !!data?.session, 
      error: error?.message 
    });
    
    if (!error && data?.session?.user) {
      const user = data.session.user;
      
      // Check if this is a new signup by seeing if user was created in the last 60 seconds
      const userCreatedAt = new Date(user.created_at);
      const now = new Date();
      const isNewSignup = (now.getTime() - userCreatedAt.getTime()) < 60000; // 60 seconds
      
      // Check if profile exists - might be missing if user was "soft deleted"
      // (profile deleted but auth user remained)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('id', user.id)
        .single();
      
      if (!profile) {
        console.log('Profile missing for auth user, creating new profile...');
        
        const username = user.user_metadata?.name || user.email?.split('@')[0] || 'user';
        
        // Create the profile (mimics the handle_new_user trigger behavior)
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email!,
            username,
            avatar_url: user.user_metadata?.avatar_url,
          });
        
        if (insertError) {
          console.error('Failed to create profile:', insertError.message);
          // Don't fail the auth flow - the user is authenticated, just profile creation failed
        } else {
          console.log('Profile created successfully');
          
          // Notify admin of new signup (async, don't block auth flow)
          notifyNewSignup({
            email: user.email!,
            username,
            signupTime: new Date(),
          }).catch((err) => console.error('Failed to send signup notification:', err));
        }
      } else if (isNewSignup) {
        // Profile was created by the database trigger, but this is still a new signup
        console.log('New user signup detected, sending notification...');
        const username = profile.username || user.user_metadata?.name || user.email?.split('@')[0] || 'user';
        
        notifyNewSignup({
          email: user.email!,
          username,
          signupTime: userCreatedAt,
        }).catch((err) => console.error('Failed to send signup notification:', err));
      }
      
      return NextResponse.redirect(`${origin}${next}`);
    }
    
    if (error) {
      console.error('Session exchange error:', error.message);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}


