'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Bot, Users, UserCircle, Globe } from 'lucide-react';

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
            Are you <span className="text-emerald-400">aligned</span>?
          </h1>
          <p className="text-lg text-zinc-400 mb-8">
            Vote on yes/no questions and discover how your values and opinions 
            compare with AI, friends, family, and strangers.
          </p>
          <Button onClick={signInWithGoogle} size="lg" className="text-lg px-8 py-6">
            Get Started with Google
          </Button>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-20 max-w-5xl w-full px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center">
            <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Bot className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-base font-semibold text-zinc-100 mb-1">Compare with AI</h3>
            <p className="text-zinc-400 text-sm">
              See how your views align with artificial intelligence
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center">
            <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-rose-400" />
            </div>
            <h3 className="text-base font-semibold text-zinc-100 mb-1">Friends & Family</h3>
            <p className="text-zinc-400 text-sm">
              Discover common ground with the people you know
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center">
            <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Globe className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-base font-semibold text-zinc-100 mb-1">Strangers</h3>
            <p className="text-zinc-400 text-sm">
              Find like-minded people you&apos;ve never met
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <UserCircle className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-base font-semibold text-zinc-100 mb-1">Yourself</h3>
            <p className="text-zinc-400 text-sm">
              Reflect on your own values and beliefs
            </p>
          </div>
        </div>

        {/* AI highlight */}
        <div className="mt-16 max-w-xl text-center px-4">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-2 mb-4">
            <Bot className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300">Powered by GPT-4.1-mini</span>
          </div>
          <p className="text-zinc-400">
            Our AI votes on every question with reasoning. Compare your alignment 
            score and see where you agree or differ.
          </p>
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

