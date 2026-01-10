import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return new Response('Missing code parameter', { status: 400 });
    }

    // Fetch invite data
    const supabase = await createClient();
    const { data: invite } = await supabase
      .from('invites')
      .select(`
        inviter_id,
        profiles!invites_inviter_id_fkey (
          username
        )
      `)
      .eq('invite_code', code)
      .single();

    // Handle both single object and array returns from Supabase
    const profilesData = invite?.profiles as unknown;
    const profile = Array.isArray(profilesData) 
      ? (profilesData[0] as { username: string | null })
      : (profilesData as { username: string | null });
    
    const inviterName = profile?.username || 'Someone';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#09090b',
            backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(99, 102, 241, 0.2) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(139, 92, 246, 0.2) 0%, transparent 50%)',
          }}
        >
          {/* Card */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#18181b',
              borderRadius: '24px',
              padding: '48px 64px',
              maxWidth: '900px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {/* Users icon */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                marginBottom: '24px',
              }}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#818cf8"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>

            {/* Main text */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '48px',
                  fontWeight: 'bold',
                  color: '#fafafa',
                  marginBottom: '16px',
                  lineHeight: 1.2,
                }}
              >
                How aligned are you?
              </div>
              
              <div
                style={{
                  fontSize: '24px',
                  color: '#a1a1aa',
                  marginBottom: '32px',
                }}
              >
                {inviterName} wants to compare views with you
              </div>

              {/* CTA */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  backgroundColor: 'rgba(99, 102, 241, 0.3)',
                  padding: '16px 32px',
                  borderRadius: '12px',
                }}
              >
                <span style={{ fontSize: '20px', color: '#c7d2fe' }}>
                  Vote • Compare • Connect
                </span>
              </div>
            </div>

            {/* Logo */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '32px',
              }}
            >
              <span
                style={{
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: '#71717a',
                }}
              >
                Aligned
              </span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('Error generating invite OG image:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}

