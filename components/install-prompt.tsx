'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Download } from 'lucide-react';

// Trigger function to show the install prompt after user engagement
export function triggerInstallPrompt() {
  window.dispatchEvent(new CustomEvent('user-engaged'));
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [canShow, setCanShow] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Check if we should show on mobile devices
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isIOSDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');

    if (isMobile && !isStandalone && !dismissed) {
      setCanShow(true);
      setIsIOS(isIOSDevice);
    }

    // Capture the beforeinstallprompt event (Android)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  useEffect(() => {
    if (!canShow) return;

    const handleEngagement = () => {
      // Show after a short delay following engagement
      setTimeout(() => setShow(true), 2000);
    };

    window.addEventListener('user-engaged', handleEngagement);
    return () => window.removeEventListener('user-engaged', handleEngagement);
  }, [canShow]);

  const handleInstallClick = async () => {
    if (deferredPrompt.current) {
      // Android: Trigger native install prompt
      deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      if (outcome === 'accepted') {
        setShow(false);
        localStorage.setItem('pwa-prompt-dismissed', 'true');
      }
      deferredPrompt.current = null;
    }
    // iOS: Just dismiss (they need to follow the instructions manually)
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (!show) return null;

  const canInstallNatively = !isIOS && deferredPrompt.current;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="mx-auto max-w-sm rounded-xl bg-zinc-900 p-3 shadow-xl dark:bg-zinc-100">
        <div className="flex items-center gap-3">
          <button
            onClick={canInstallNatively ? handleInstallClick : undefined}
            className={`flex flex-1 items-center gap-3 ${canInstallNatively ? 'cursor-pointer' : ''}`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 dark:bg-zinc-200">
              <Download className="h-5 w-5 text-zinc-100 dark:text-zinc-800" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-zinc-100 dark:text-zinc-900">
                Install YesNoNotSure
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-600">
                {isIOS 
                  ? 'Tap Share → Add to Home Screen' 
                  : canInstallNatively
                  ? 'Tap to install'
                  : 'Tap menu → Install app'}
              </p>
            </div>
          </button>
          <button
            onClick={dismiss}
            className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 dark:hover:bg-zinc-200 dark:hover:text-zinc-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

