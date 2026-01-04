import { createClient } from '@/lib/supabase/server';
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
      
      // Check if profile exists - might be missing if user was "soft deleted"
      // (profile deleted but auth user remained)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();
      
      if (!profile) {
        console.log('Profile missing for auth user, recreating profile...');
        
        // Recreate the profile (mimics the handle_new_user trigger behavior)
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email!,
            username: user.user_metadata?.name || user.email?.split('@')[0],
            avatar_url: user.user_metadata?.avatar_url,
          });
        
        if (insertError) {
          console.error('Failed to recreate profile:', insertError.message);
          // Don't fail the auth flow - the user is authenticated, just profile creation failed
        } else {
          console.log('Profile recreated successfully');
        }
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


