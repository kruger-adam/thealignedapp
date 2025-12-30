'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Bot, Users, UserCircle, Globe, Sparkles } from 'lucide-react';

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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 backdrop-blur-sm px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Aligned" width={32} height={32} className="rounded-lg" />
            <span className="text-xl font-bold text-white">Aligned</span>
          </div>
          <Button onClick={signInWithGoogle} size="sm" className="bg-white text-slate-900 hover:bg-white/90">
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-white/80">AI-powered opinion matching</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Are you <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">aligned</span>?
          </h1>
          <p className="text-lg md:text-xl text-white/60 mb-8 leading-relaxed">
            Vote on yes/no questions and discover how your values and opinions 
            compare with AI, friends, family, and strangers.
          </p>
          <Button 
            onClick={signInWithGoogle} 
            size="lg" 
            className="text-lg px-8 py-6 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white border-0 shadow-lg shadow-emerald-500/25"
          >
            Get Started with Google
          </Button>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-20 max-w-5xl w-full px-4">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 text-center hover:bg-white/10 transition-colors">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Bot className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Compare with AI</h3>
            <p className="text-white/50 text-sm">
              See how your views align with artificial intelligence
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 text-center hover:bg-white/10 transition-colors">
            <div className="w-12 h-12 bg-gradient-to-br from-rose-500/20 to-rose-600/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-rose-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Friends & Family</h3>
            <p className="text-white/50 text-sm">
              Discover common ground with the people you know
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 text-center hover:bg-white/10 transition-colors">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Globe className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Strangers</h3>
            <p className="text-white/50 text-sm">
              Find like-minded people you&apos;ve never met
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 text-center hover:bg-white/10 transition-colors">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <UserCircle className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Yourself</h3>
            <p className="text-white/50 text-sm">
              Reflect on your own values and beliefs
            </p>
          </div>
        </div>

        {/* AI highlight */}
        <div className="mt-16 max-w-xl text-center px-4">
          <div className="inline-flex items-center gap-2 bg-purple-500/20 backdrop-blur-sm border border-purple-500/30 rounded-full px-4 py-2 mb-4">
            <Bot className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300">Powered by GPT-4.1-mini</span>
          </div>
          <p className="text-white/50">
            Our AI votes on every question with reasoning. Compare your alignment 
            score and see where you agree or differ.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 px-4 py-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-white/40">
            © 2025 Aligned. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-sm text-white/50 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm text-white/50 hover:text-white transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
