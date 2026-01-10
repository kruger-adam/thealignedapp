import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: Fetch user's existing invite code or create a new one
export async function GET() {
  const supabase = await createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check for existing invite
  const { data: existingInvite } = await supabase
    .from('invites')
    .select('invite_code')
    .eq('inviter_id', user.id)
    .is('accepted_by', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existingInvite) {
    return NextResponse.json({ inviteCode: existingInvite.invite_code });
  }

  // Generate a new invite code
  const { data: codeResult } = await supabase.rpc('generate_invite_code');
  const inviteCode = codeResult as string;

  // Create the invite
  const { error: insertError } = await supabase
    .from('invites')
    .insert({
      inviter_id: user.id,
      invite_code: inviteCode,
    });

  if (insertError) {
    // If code collision, try again with a different code
    if (insertError.code === '23505') {
      const { data: retryCode } = await supabase.rpc('generate_invite_code');
      const { error: retryError } = await supabase
        .from('invites')
        .insert({
          inviter_id: user.id,
          invite_code: retryCode as string,
        });
      
      if (retryError) {
        return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
      }
      
      return NextResponse.json({ inviteCode: retryCode });
    }
    
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
  }

  return NextResponse.json({ inviteCode });
}

// POST: Accept an invite (called after user signs up)
export async function POST(request: Request) {
  const supabase = await createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { inviteCode } = body;

  if (!inviteCode) {
    return NextResponse.json({ error: 'Invite code required' }, { status: 400 });
  }

  // Find the invite
  const { data: invite, error: findError } = await supabase
    .from('invites')
    .select('id, inviter_id, accepted_by')
    .eq('invite_code', inviteCode)
    .single();

  if (findError || !invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }

  // Don't let users accept their own invite
  if (invite.inviter_id === user.id) {
    return NextResponse.json({ error: 'Cannot accept your own invite' }, { status: 400 });
  }

  // Check if already accepted
  if (invite.accepted_by) {
    return NextResponse.json({ error: 'Invite already used' }, { status: 400 });
  }

  // Accept the invite
  const { error: updateError } = await supabase
    .from('invites')
    .update({
      accepted_by: user.id,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invite.id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 });
  }

  // Update the user's profile with invited_by
  await supabase
    .from('profiles')
    .update({ invited_by: invite.inviter_id })
    .eq('id', user.id);

  // Create notification for the inviter
  await supabase
    .from('notifications')
    .insert({
      user_id: invite.inviter_id,
      type: 'invite_accepted',
      actor_id: user.id,
    });

  return NextResponse.json({ 
    success: true, 
    inviterId: invite.inviter_id 
  });
}

