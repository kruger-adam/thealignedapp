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

    // Fetch challenge data
    const supabase = await createClient();
    const { data: challenge } = await supabase
      .from('share_challenges')
      .select(`
        sharer_vote,
        questions (content)
      `)
      .eq('code', code)
      .single();

    if (!challenge || !challenge.questions) {
      return new Response('Challenge not found', { status: 404 });
    }

    const question = challenge.questions as { content: string };
    const questionContent = question.content.length > 120 
      ? question.content.slice(0, 120) + '...' 
      : question.content;

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
            backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(139, 92, 246, 0.15) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(236, 72, 153, 0.15) 0%, transparent 50%)',
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
            {/* Question Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(139, 92, 246, 0.2)',
                padding: '8px 16px',
                borderRadius: '999px',
                marginBottom: '24px',
              }}
            >
              <span style={{ fontSize: '24px' }}>❓</span>
              <span style={{ color: '#a78bfa', fontSize: '18px', fontWeight: 600 }}>
                Do you agree?
              </span>
            </div>

            {/* Question */}
            <div
              style={{
                fontSize: '42px',
                fontWeight: 700,
                color: '#fafafa',
                textAlign: 'center',
                lineHeight: 1.3,
                marginBottom: '32px',
              }}
            >
              &ldquo;{questionContent}&rdquo;
            </div>

            {/* Vote prompt */}
            <div
              style={{
                display: 'flex',
                gap: '16px',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  padding: '12px 32px',
                  borderRadius: '12px',
                  fontSize: '20px',
                  fontWeight: 600,
                }}
              >
                ✓ Yes
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(244, 63, 94, 0.2)',
                  color: '#fb7185',
                  padding: '12px 32px',
                  borderRadius: '12px',
                  fontSize: '20px',
                  fontWeight: 600,
                }}
              >
                ✗ No
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                  color: '#fbbf24',
                  padding: '12px 32px',
                  borderRadius: '12px',
                  fontSize: '20px',
                  fontWeight: 600,
                }}
              >
                ? Unsure
              </div>
            </div>

            {/* CTA */}
            <div
              style={{
                color: '#a1a1aa',
                fontSize: '18px',
                fontWeight: 500,
              }}
            >
              Vote and see if you agree with your friend!
            </div>
          </div>

          {/* Branding */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '32px',
            }}
          >
            <span style={{ color: '#71717a', fontSize: '20px' }}>Powered by</span>
            <span style={{ color: '#fafafa', fontSize: '22px', fontWeight: 700 }}>Aligned</span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('Error generating OG image:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}

