'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, ArrowRight, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';

interface InviteClientProps {
  inviteCode: string;
  inviterId: string;
  inviterUsername: string | null;
  inviterAvatarUrl: string | null;
  isAccepted: boolean;
}

export function InviteClient({
  inviteCode,
  inviterId,
  inviterUsername,
  inviterAvatarUrl,
  isAccepted,
}: InviteClientProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(isAccepted);
  const supabase = createClient();

  const inviterName = inviterUsername || 'Someone';

  // If user is logged in and invite not accepted, accept it automatically
  useEffect(() => {
    async function acceptInvite() {
      if (!user || accepted || accepting) return;
      
      // Don't accept your own invite
      if (user.id === inviterId) {
        router.push('/');
        return;
      }

      setAccepting(true);
      
      try {
        const response = await fetch('/api/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviteCode }),
        });

        if (response.ok) {
          setAccepted(true);
          // Redirect to feed after a moment
          setTimeout(() => {
            router.push('/');
          }, 2000);
        }
      } catch (error) {
        console.error('Error accepting invite:', error);
      }
      
      setAccepting(false);
    }

    acceptInvite();
  }, [user, accepted, accepting, inviteCode, inviterId, router]);

  const handleSignIn = async () => {
    // Store invite code in session storage for after sign-up
    sessionStorage.setItem('pendingInviteCode', inviteCode);
    
    const redirectUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/invite/${inviteCode}`)}`;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
      </div>
    );
  }

  // Already accepted - show success
  if (accepted && user) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <Card className="overflow-hidden">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            
            <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              You&apos;re Connected!
            </h1>
            
            <p className="mb-6 text-zinc-600 dark:text-zinc-400">
              Vote on questions and you&apos;ll start seeing your alignment with {inviterName}.
            </p>

            <Button
              onClick={() => router.push('/')}
              className="w-full gap-2"
            >
              Start Voting
              <ArrowRight className="h-4 w-4" />
            </Button>

            <Link
              href={`/profile/${inviterId}`}
              className="mt-4 block text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              View {inviterName}&apos;s profile
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User logged in but hasn't accepted yet - show accepting state
  if (user && accepting) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <Card className="overflow-hidden">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-6 h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600" />
            <p className="text-zinc-600 dark:text-zinc-400">
              Connecting you with {inviterName}...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not logged in - show invite card
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card className="overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 px-8 py-10 text-center text-white">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/30 bg-white/20 backdrop-blur-sm">
            <Users className="h-10 w-10" />
          </div>
          
          <h1 className="mb-2 text-2xl font-bold">
            How aligned are you?
          </h1>
          
          <p className="text-white/90">
            {inviterName} wants to compare views with you
          </p>
        </div>

        <CardContent className="p-8">
          {/* Inviter info */}
          <div className="mb-8 flex items-center justify-center gap-3">
            <Avatar
              src={inviterAvatarUrl}
              fallback={inviterName}
              size="lg"
            />
            <div className="text-left">
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {inviterName}
              </p>
              <p className="text-sm text-zinc-500">
                invited you to Aligned
              </p>
            </div>
          </div>

          {/* What is Aligned */}
          <div className="mb-8 space-y-3 text-center">
            <p className="text-zinc-600 dark:text-zinc-400">
              Vote on questions that matter.
              <br />
              See how your views compare.
            </p>
            
            <div className="flex items-center justify-center gap-6 text-sm text-zinc-500">
              <span>🗳️ Vote</span>
              <span>📊 Compare</span>
              <span>🤝 Connect</span>
            </div>
          </div>

          {/* Sign up button */}
          <Button
            onClick={handleSignIn}
            size="lg"
            className="w-full gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700"
          >
            Sign up to see your alignment
            <ArrowRight className="h-4 w-4" />
          </Button>

          <p className="mt-4 text-center text-xs text-zinc-500">
            Free to join. Sign in with Google.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

