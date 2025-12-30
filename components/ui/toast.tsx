'use client';

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface ToastContextType {
  showToast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setIsVisible(true));

    // Auto dismiss after 3 seconds
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(onDismiss, 200);
    }, 3000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-lg transition-all duration-200 dark:bg-zinc-100 dark:text-zinc-900",
        isVisible && !isLeaving ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      )}
    >
      <span>{toast.message}</span>
      <button
        onClick={() => {
          setIsLeaving(true);
          setTimeout(onDismiss, 200);
        }}
        className="text-zinc-400 hover:text-white dark:text-zinc-500 dark:hover:text-zinc-900"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

