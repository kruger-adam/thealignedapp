'use client';

import { Bot, X } from 'lucide-react';
import { useAIAssistant } from './ai-assistant-provider';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

export function AIAssistantFAB() {
  const { user } = useAuth();
  const { isOpen, toggleAssistant } = useAIAssistant();

  // Don't show FAB for logged-out users
  if (!user) return null;

  return (
    <button
      onClick={toggleAssistant}
      className={cn(
        'fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300',
        'bg-gradient-to-br from-violet-500 to-indigo-600 text-white',
        'hover:from-violet-600 hover:to-indigo-700 hover:shadow-xl hover:scale-105',
        'active:scale-95',
        'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2',
        // Adjust position when panel is open on desktop
        'lg:bottom-6 lg:right-6',
        isOpen && 'lg:right-[calc(420px+1.5rem)]'
      )}
      aria-label={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
    >
      <div className={cn(
        'transition-transform duration-300',
        isOpen && 'rotate-180'
      )}>
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Bot className="h-6 w-6" />
        )}
      </div>
      
      {/* Pulse animation when closed */}
      {!isOpen && (
        <span className="absolute inset-0 animate-ping rounded-full bg-violet-400 opacity-20" />
      )}
    </button>
  );
}

