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
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    
    console.error('Session exchange error:', error.message);
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}


