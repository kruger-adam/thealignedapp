'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, Trophy } from 'lucide-react';
import { Confetti } from './confetti';
import { cn } from '@/lib/utils';

interface OnboardingCompleteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingComplete({ isOpen, onClose }: OnboardingCompleteProps) {
  const router = useRouter();
  const [showConfetti, setShowConfetti] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Trigger confetti
      setShowConfetti(true);
      // Trigger modal entrance
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
      setShowConfetti(false);
    }
  }, [isOpen]);

  const handleViewAI = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
      router.push('/profile/ai');
    }, 300);
  };

  const handleContinue = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  if (!isOpen) return null;

  return (
    <>
      <Confetti isActive={showConfetti} />
      
      <div 
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 transition-opacity duration-300",
          isVisible ? "opacity-100" : "opacity-0"
        )}
      >
        <div 
          className={cn(
            "relative w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 shadow-2xl transition-all duration-500",
            isVisible ? "scale-100 opacity-100 translate-y-0" : "scale-90 opacity-0 translate-y-8"
          )}
        >
          {/* Celebration header */}
          <div className="relative px-6 pt-8 pb-6 text-center overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-violet-500/20 via-transparent to-transparent" />
            
            {/* Trophy icon */}
            <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30">
              <Trophy className="h-10 w-10 text-white" />
            </div>
            
            <h2 className="relative text-2xl font-bold text-white mb-2">
              You did it! 🎉
            </h2>
            <p className="relative text-zinc-400">
              You&apos;ve voted on 10 polls. Now let&apos;s see how aligned you are with our AI.
            </p>
          </div>

          {/* AI preview card */}
          <div className="px-6 pb-4">
            <div className="rounded-2xl bg-zinc-800/50 border border-zinc-700 p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500">
                  <Sparkles className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white">AI</p>
                  <p className="text-sm text-zinc-400">
                    See where you agree and disagree
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-zinc-500" />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 pb-8">
            <button
              onClick={handleViewAI}
              className="w-full py-4 rounded-2xl font-semibold text-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600 shadow-lg shadow-violet-500/25 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span>Compare with AI</span>
              <ArrowRight className="h-5 w-5" />
            </button>
            
            <button
              onClick={handleContinue}
              className="w-full mt-3 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Continue voting
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

