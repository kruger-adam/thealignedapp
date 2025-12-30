'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle2, Users, BarChart3, MessageCircle } from 'lucide-react';

export function LandingPage() {
  const supabase = createClient();

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Aligned" width={32} height={32} className="rounded-lg" />
            <span className="text-xl font-bold text-zinc-100">Aligned</span>
          </div>
          <Button onClick={signInWithGoogle} variant="outline" size="sm">
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-2xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-zinc-100 mb-4">
            Discover where you <span className="text-emerald-400">align</span>
          </h1>
          <p className="text-lg text-zinc-400 mb-8">
            Vote on yes/no questions, see how your opinions compare with friends, 
            and find out who you&apos;re most aligned with.
          </p>
          <Button onClick={signInWithGoogle} size="lg" className="text-lg px-8 py-6">
            Get Started with Google
          </Button>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mt-20 max-w-4xl w-full px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-100 mb-2">Vote on Questions</h3>
            <p className="text-zinc-400 text-sm">
              Simple yes/no/not sure voting on thought-provoking questions
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-100 mb-2">Find Your People</h3>
            <p className="text-zinc-400 text-sm">
              See compatibility scores and discover who thinks like you
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-100 mb-2">Join the Discussion</h3>
            <p className="text-zinc-400 text-sm">
              Comment on questions and even ask AI for its perspective
            </p>
          </div>
        </div>

        {/* Stats preview */}
        <div className="mt-16 flex items-center gap-8 text-center">
          <div>
            <div className="text-2xl font-bold text-zinc-100">100+</div>
            <div className="text-sm text-zinc-500">Questions</div>
          </div>
          <div className="w-px h-8 bg-zinc-800" />
          <div>
            <div className="text-2xl font-bold text-zinc-100">1,000+</div>
            <div className="text-sm text-zinc-500">Votes Cast</div>
          </div>
          <div className="w-px h-8 bg-zinc-800" />
          <div>
            <div className="text-2xl font-bold text-zinc-100 flex items-center gap-1">
              <BarChart3 className="w-5 h-5" /> AI
            </div>
            <div className="text-sm text-zinc-500">Powered</div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-4 py-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-zinc-500">
            © 2025 Aligned. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

