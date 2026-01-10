import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { InviteClient } from './invite-client';

interface InvitePageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: InvitePageProps): Promise<Metadata> {
  const { code } = await params;
  const supabase = await createClient();

  // Fetch invite with inviter profile
  const { data: invite } = await supabase
    .from('invites')
    .select(`
      invite_code,
      inviter_id,
      profiles!invites_inviter_id_fkey (
        username,
        avatar_url
      )
    `)
    .eq('invite_code', code)
    .single();

  if (!invite) {
    return {
      title: 'Invite | Aligned',
      description: 'Join Aligned and see how your views align with others.',
    };
  }

  // Handle both single object and array returns from Supabase relations
  const profilesData = invite.profiles as unknown;
  const inviter = Array.isArray(profilesData) 
    ? (profilesData[0] as { username: string | null; avatar_url: string | null })
    : (profilesData as { username: string | null; avatar_url: string | null });
  const inviterName = inviter?.username || 'Someone';

  return {
    title: `${inviterName} wants to see how aligned you are | Aligned`,
    description: `${inviterName} invited you to Aligned. Vote on questions and discover how your views compare!`,
    openGraph: {
      title: `${inviterName} wants to see how aligned you are`,
      description: 'Join Aligned, vote on questions, and see your alignment score!',
      type: 'website',
      images: [
        {
          url: `/api/og/invite?code=${code}`,
          width: 1200,
          height: 630,
          alt: 'Invitation to Aligned',
        },
      ],
    },
  };
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { code } = await params;
  const supabase = await createClient();

  // Fetch invite with inviter profile
  const { data: invite, error } = await supabase
    .from('invites')
    .select(`
      id,
      invite_code,
      inviter_id,
      accepted_by,
      profiles!invites_inviter_id_fkey (
        id,
        username,
        avatar_url
      )
    `)
    .eq('invite_code', code)
    .single();

  if (error || !invite) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Invite Not Found
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            This invite link may have expired or is invalid.
          </p>
        </div>
      </div>
    );
  }

  // Handle both single object and array returns from Supabase relations
  const inviterProfileData = invite.profiles as unknown;
  const inviter = Array.isArray(inviterProfileData)
    ? (inviterProfileData[0] as { id: string; username: string | null; avatar_url: string | null })
    : (inviterProfileData as { id: string; username: string | null; avatar_url: string | null });

  return (
    <InviteClient
      inviteCode={code}
      inviterId={inviter?.id || invite.inviter_id}
      inviterUsername={inviter?.username || null}
      inviterAvatarUrl={inviter?.avatar_url || null}
      isAccepted={!!invite.accepted_by}
    />
  );
}

