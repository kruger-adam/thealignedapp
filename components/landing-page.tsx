'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { 
  Bot, 
  Users, 
  EyeOff, 
  TrendingUp, 
  MessageCircle, 
  History, 
  ExternalLink,
  Check,
  ArrowRight,
  Zap
} from 'lucide-react';
import { ProductHuntBadge } from '@/components/product-hunt-badge';

// Detect in-app browsers (Facebook, Messenger, Instagram, etc.)
function isInAppBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || '';
  return /FBAN|FBAV|Instagram|Messenger|LinkedIn|Twitter|MicroMessenger|Line|WhatsApp/i.test(ua);
}

// Sample questions for typewriter effect
const SAMPLE_QUESTIONS = [
  "Should voting be mandatory?",
  "Is it okay to lie to protect someone's feelings?",
  "Would you take a pill that makes you happy forever?",
  "Is social media making us lonelier?",
  "Should AI have legal rights?",
  "Is free will an illusion?",
  "Would you want to know the date of your death?",
];

// Typewriter input component
function TypewriterInput() {
  const [displayText, setDisplayText] = useState(SAMPLE_QUESTIONS[0].slice(0, 1));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const currentQuestion = SAMPLE_QUESTIONS[questionIndex];

  const typeCharacter = useCallback(() => {
    if (displayText.length < currentQuestion.length) {
      setDisplayText(currentQuestion.slice(0, displayText.length + 1));
    } else {
      setIsTyping(false);
      setIsPaused(true);
    }
  }, [displayText, currentQuestion]);

  const deleteCharacter = useCallback(() => {
    if (displayText.length > 0) {
      setDisplayText(displayText.slice(0, -1));
    } else {
      // Move to next question immediately with first char (no flash)
      const nextIndex = (questionIndex + 1) % SAMPLE_QUESTIONS.length;
      setQuestionIndex(nextIndex);
      setDisplayText(SAMPLE_QUESTIONS[nextIndex].slice(0, 1));
      setIsTyping(true);
    }
  }, [displayText, questionIndex]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (isPaused) {
      // Pause at the end of typing (matches create-question.tsx)
      timeout = setTimeout(() => {
        setIsPaused(false);
      }, 500);
    } else if (isTyping) {
      // Typing speed: 30-50ms per char (matches create-question.tsx)
      timeout = setTimeout(typeCharacter, 30 + Math.random() * 20);
    } else {
      // Backspace speed: 15ms (matches create-question.tsx)
      timeout = setTimeout(deleteCharacter, 15);
    }

    return () => clearTimeout(timeout);
  }, [displayText, isTyping, isPaused, typeCharacter, deleteCharacter]);

  return (
    <div className="w-full max-w-lg">
      <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-2xl p-4 shadow-2xl shadow-black/50">
        {/* Input header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center">
            <span className="text-xs text-zinc-300">?</span>
          </div>
          <span className="text-sm text-zinc-500">Ask a question...</span>
        </div>
        
        {/* Typewriter text area */}
        <div className="min-h-[80px] flex items-start">
          <p className="text-xl md:text-2xl text-zinc-100 font-medium leading-relaxed">
            {displayText}
            <span className="inline-block w-0.5 h-6 bg-zinc-400 ml-0.5 animate-pulse" />
          </p>
        </div>

        {/* Vote buttons preview (disabled) */}
        <div className="flex gap-2 mt-4 opacity-50">
          <div className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-500 text-center text-sm font-medium">
            Yes
          </div>
          <div className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-500 text-center text-sm font-medium">
            No
          </div>
          <div className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-500 text-center text-sm font-medium">
            Unsure
          </div>
        </div>
      </div>
      
      {/* Subtle hint */}
      <p className="text-center text-xs text-zinc-600 mt-3">
        Ask anything. Get answers.
      </p>
    </div>
  );
}

export function LandingPage() {
  const supabase = createClient();
  const [showInAppWarning, setShowInAppWarning] = useState(false);
  const [isInApp, setIsInApp] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setIsInApp(isInAppBrowser());
    setMounted(true);
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
      {/* Gradient mesh background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-500/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] bg-rose-500/8 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-violet-500/10 rounded-full blur-[100px]" />
        {/* Grid overlay */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* Header */}
      <header className={`relative z-10 border-b border-zinc-800/50 px-4 py-4 ${mounted ? 'animate-in slide-in-from-top-2' : 'opacity-0'}`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Aligned" width={32} height={32} className="rounded-lg" />
            <span className="text-xl font-bold text-zinc-100">Aligned</span>
          </div>
          <Button onClick={handleSignIn} size="sm" variant="ghost" className="text-zinc-300 hover:text-white">
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1">
        <section className="max-w-6xl mx-auto px-4 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Copy */}
            <div className={mounted ? 'animate-in slide-in-from-bottom-2' : 'opacity-0'}>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-zinc-100 mb-6 leading-[1.1] tracking-tight">
                Disagreements feel{' '}
                <span className="text-zinc-500 line-through decoration-zinc-600">total</span>.
                <br />
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  They&apos;re usually not.
                </span>
              </h1>
              <p className="text-lg md:text-xl text-zinc-400 mb-8 leading-relaxed max-w-xl">
                Vote on questions. Discover where you actually agree with friends, strangers, and AI—not just where you clash.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 items-start">
                <Button 
                  onClick={handleSignIn} 
                  size="lg" 
                  className="text-base px-6 py-5 bg-zinc-100 hover:bg-white text-zinc-900 border-0 shadow-lg shadow-zinc-100/10 gap-2"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <a 
                  href="#features"
                  className="inline-flex items-center justify-center px-6 py-3 text-base text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  See how it works
                </a>
              </div>
              <div className="mt-4">
                <ProductHuntBadge variant="banner" />
              </div>
            </div>

            {/* Right: Typewriter input */}
            <div className={`flex justify-center lg:justify-end ${mounted ? 'animate-in slide-in-from-bottom-2 stagger-2' : 'opacity-0'}`} style={{ animationDelay: '100ms' }}>
              <TypewriterInput />
            </div>
          </div>
        </section>

        {/* Stats bar */}
        <section className={`border-y border-zinc-800/50 bg-zinc-900/30 backdrop-blur-sm ${mounted ? 'animate-in slide-in-from-bottom-2' : 'opacity-0'}`} style={{ animationDelay: '150ms' }}>
          <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl md:text-3xl font-bold text-zinc-100">Yes / No</div>
              <div className="text-sm text-zinc-500">Simple binary voting</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold text-zinc-100">15+</div>
              <div className="text-sm text-zinc-500">Topic categories</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">AI</div>
              <div className="text-sm text-zinc-500">Votes on everything</div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="max-w-6xl mx-auto px-4 py-20 md:py-28">
          <div className={`text-center mb-16 ${mounted ? 'animate-in slide-in-from-bottom-2' : 'opacity-0'}`} style={{ animationDelay: '200ms' }}>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-4">
              More than polling. <span className="text-zinc-500">Understanding.</span>
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Find exactly where you align and diverge—with people you know, people you don&apos;t, and artificial intelligence.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Feature 1: Common Ground */}
            <div className="group bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 hover:border-emerald-500/30 hover:bg-zinc-900/80 transition-all duration-300">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-2">Find Common Ground</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                See your agreement rate with any user. Discover shared values you didn&apos;t know you had.
              </p>
            </div>

            {/* Feature 2: Divergence */}
            <div className="group bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 hover:border-rose-500/30 hover:bg-zinc-900/80 transition-all duration-300">
              <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-5 h-5 text-rose-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-2">Pinpoint Divergence</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Sort by &quot;Most Split&quot; to find exactly where opinions divide. No more guessing.
              </p>
            </div>

            {/* Feature 3: Anonymous */}
            <div className="group bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 hover:border-amber-500/30 hover:bg-zinc-900/80 transition-all duration-300">
              <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <EyeOff className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-2">Vote Honestly</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Anonymous voting reveals true preferences. No social cost for controversial opinions.
              </p>
            </div>

            {/* Feature 4: AI Comparison */}
            <div className="group bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 hover:border-violet-500/30 hover:bg-zinc-900/80 transition-all duration-300">
              <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Bot className="w-5 h-5 text-violet-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-2">Compare with AI</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                The AI votes on every question with reasoning. See where the model aligns—or doesn&apos;t—with you.
              </p>
            </div>

            {/* Feature 5: Debate AI */}
            <div className="group bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 hover:border-violet-500/30 hover:bg-zinc-900/80 transition-all duration-300">
              <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-5 h-5 text-violet-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-2">Debate the AI</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Tag @AI in any comment thread. It responds with context-aware reasoning.
              </p>
            </div>

            {/* Feature 6: Track Evolution */}
            <div className="group bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 hover:border-cyan-500/30 hover:bg-zinc-900/80 transition-all duration-300">
              <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <History className="w-5 h-5 text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-2">Track Your Evolution</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Vote history shows when you changed your mind. Watch your opinions evolve.
              </p>
            </div>
          </div>
        </section>

        {/* AI Section */}
        <section className="border-y border-zinc-800/50 bg-gradient-to-b from-zinc-900/50 to-zinc-950">
          <div className="max-w-6xl mx-auto px-4 py-20 md:py-28">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-4">
                  An AI that has opinions
                </h2>
                <p className="text-zinc-400 mb-6 leading-relaxed">
                  Our AI doesn&apos;t just observe—it votes. On every question. With reasoning. 
                  Compare your alignment score and discover where you and the model see differently.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-zinc-300">
                    <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center">
                      <Check className="w-3 h-3 text-violet-400" />
                    </div>
                    Votes on every question with explanations
                  </li>
                  <li className="flex items-center gap-3 text-zinc-300">
                    <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center">
                      <Check className="w-3 h-3 text-violet-400" />
                    </div>
                    Responds when @mentioned in discussions
                  </li>
                  <li className="flex items-center gap-3 text-zinc-300">
                    <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center">
                      <Check className="w-3 h-3 text-violet-400" />
                    </div>
                    Posts thought-provoking questions
                  </li>
                </ul>
              </div>
              <div className="flex justify-center">
                <div className="relative">
                  {/* AI profile card mock */}
                  <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-2xl p-6 max-w-sm shadow-2xl shadow-violet-500/10">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                        <Bot className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <div className="text-xl font-semibold text-zinc-100">AI</div>
                        <div className="text-sm text-zinc-500">Votes on everything</div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400">Your alignment</span>
                        <span className="text-2xl font-bold text-violet-400">73%</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full" style={{ width: '73%' }} />
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="text-center p-3 bg-zinc-800/50 rounded-xl">
                          <div className="text-lg font-semibold text-emerald-400">42</div>
                          <div className="text-xs text-zinc-500">Common Ground</div>
                        </div>
                        <div className="text-center p-3 bg-zinc-800/50 rounded-xl">
                          <div className="text-lg font-semibold text-rose-400">15</div>
                          <div className="text-xs text-zinc-500">Divergence</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Decorative glow */}
                  <div className="absolute -inset-4 bg-violet-500/5 rounded-3xl blur-2xl -z-10" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-6xl mx-auto px-4 py-20 md:py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-full px-4 py-1.5 mb-6">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-zinc-300">Free to use</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-4">
            Ready to find your alignment?
          </h2>
          <p className="text-zinc-400 max-w-lg mx-auto mb-8">
            Join and start voting. Discover where you stand—with friends, strangers, and AI.
          </p>
          <div className="flex flex-col items-center gap-4">
            <Button 
              onClick={handleSignIn} 
              size="lg" 
              className="text-base px-8 py-6 bg-zinc-100 hover:bg-white text-zinc-900 border-0 shadow-lg shadow-zinc-100/10 gap-2"
            >
              Get Started with Google
              <ArrowRight className="w-4 h-4" />
            </Button>
            <ProductHuntBadge variant="banner" />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-800/50 px-4 py-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-zinc-600">
            © 2025 Aligned
          </p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </footer>

      {/* In-app browser warning modal */}
      {showInAppWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 p-6 shadow-xl border border-zinc-800">
            <h2 className="mb-2 text-lg font-semibold text-zinc-100">
              Open in Browser
            </h2>
            <p className="mb-4 text-sm text-zinc-400">
              Google Sign-In doesn&apos;t work in this browser. Please open in Safari or Chrome:
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
                className="flex-1 gap-1.5 bg-zinc-100 hover:bg-white text-zinc-900"
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
