'use client';

import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Only show on mobile devices
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isIOSDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');

    if (isMobile && !isStandalone && !dismissed) {
      // Small delay so it doesn't appear immediately
      setTimeout(() => setShow(true), 3000);
      setIsIOS(isIOSDevice);
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="mx-auto max-w-sm rounded-xl bg-zinc-900 p-3 shadow-xl dark:bg-zinc-100">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 dark:bg-zinc-200">
            <Download className="h-5 w-5 text-zinc-100 dark:text-zinc-800" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-100 dark:text-zinc-900">
              Install YesNoNotSure
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-600">
              {isIOS 
                ? 'Tap Share → Add to Home Screen' 
                : 'Tap menu → Install app'}
            </p>
          </div>
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

