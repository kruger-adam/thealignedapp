'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Bot, Users, UserCircle, Globe, Sparkles, ExternalLink } from 'lucide-react';

// Detect in-app browsers (Facebook, Messenger, Instagram, etc.)
function isInAppBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || '';
  // Check for common in-app browser signatures
  return /FBAN|FBAV|Instagram|Messenger|LinkedIn|Twitter|MicroMessenger|Line|WhatsApp/i.test(ua);
}

export function LandingPage() {
  const supabase = createClient();
  const [showInAppWarning, setShowInAppWarning] = useState(false);
  const [isInApp, setIsInApp] = useState(false);

  useEffect(() => {
    setIsInApp(isInAppBrowser());
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleSignIn = () => {
    if (isInApp) {
      setShowInAppWarning(true);
    } else {
      signInWithGoogle();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 relative overflow-hidden">
      {/* Subtle animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-zinc-800 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Aligned" width={32} height={32} className="rounded-lg" />
            <span className="text-xl font-bold text-zinc-100">Aligned</span>
          </div>
          <Button onClick={handleSignIn} size="sm">
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-full px-4 py-1.5 mb-6">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-zinc-300">AI-powered opinion matching</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-zinc-100 mb-6 leading-tight">
            Are you <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">aligned</span>?
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 mb-8 leading-relaxed">
            Vote on yes/no questions and discover how your values and opinions 
            compare with AI, friends, family, and strangers.
          </p>
          <Button 
            onClick={handleSignIn} 
            size="lg" 
            className="text-lg px-8 py-6 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white border-0 shadow-lg shadow-emerald-500/25"
          >
            Get Started with Google
          </Button>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-20 max-w-5xl w-full px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center hover:border-zinc-700 transition-colors">
            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Bot className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-base font-semibold text-zinc-100 mb-1">Compare with AI</h3>
            <p className="text-zinc-400 text-sm">
              See how your views align with artificial intelligence
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center hover:border-zinc-700 transition-colors">
            <div className="w-12 h-12 bg-rose-500/10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-rose-400" />
            </div>
            <h3 className="text-base font-semibold text-zinc-100 mb-1">Friends & Family</h3>
            <p className="text-zinc-400 text-sm">
              Discover common ground with the people you know
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center hover:border-zinc-700 transition-colors">
            <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Globe className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-base font-semibold text-zinc-100 mb-1">Strangers</h3>
            <p className="text-zinc-400 text-sm">
              Find like-minded people you&apos;ve never met
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center hover:border-zinc-700 transition-colors">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mx-auto mb-3">
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
      <footer className="relative z-10 border-t border-zinc-800 px-4 py-6">
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

      {/* In-app browser warning modal */}
      {showInAppWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-zinc-900 p-6 shadow-xl border border-zinc-800">
            <h2 className="mb-2 text-lg font-semibold text-zinc-100">
              Open in Browser
            </h2>
            <p className="mb-4 text-sm text-zinc-400">
              Google Sign-In doesn&apos;t work in this browser. Please open this page in Safari or Chrome:
            </p>
            <ol className="mb-4 space-y-2 text-sm text-zinc-400">
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-medium">1</span>
                <span>Tap the <strong className="text-zinc-200">⋯</strong> or <strong className="text-zinc-200">Share</strong> button</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-medium">2</span>
                <span>Select <strong className="text-zinc-200">&quot;Open in Safari&quot;</strong> or <strong className="text-zinc-200">&quot;Open in Browser&quot;</strong></span>
              </li>
            </ol>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInAppWarning(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  setShowInAppWarning(false);
                }}
                className="flex-1 gap-1.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Copy Link
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
