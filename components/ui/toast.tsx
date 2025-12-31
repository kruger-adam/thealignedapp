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

  const typeStyles = {
    info: "bg-zinc-900 dark:bg-zinc-100",
    success: "bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-500 dark:to-teal-500",
    warning: "bg-amber-500 dark:bg-amber-500",
    error: "bg-rose-500 dark:bg-rose-500",
  };

  const isColoredType = toast.type && toast.type !== 'info';

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl px-4 py-3 text-sm shadow-lg transition-all duration-200",
        typeStyles[toast.type || 'info'],
        isColoredType ? "text-white dark:text-white" : "text-white dark:text-zinc-900",
        isVisible && !isLeaving ? "translate-y-0 opacity-100 scale-100" : "translate-y-2 opacity-0 scale-95",
        toast.type === 'success' && isVisible && !isLeaving && "animate-bounce-once"
      )}
    >
      {toast.type === 'success' && <span className="text-lg">🎉</span>}
      <span className="font-medium">{toast.message}</span>
      <button
        onClick={() => {
          setIsLeaving(true);
          setTimeout(onDismiss, 200);
        }}
        className={cn(
          "transition-opacity hover:opacity-80",
          isColoredType ? "text-white/70" : "text-zinc-400 hover:text-white dark:text-zinc-500 dark:hover:text-zinc-900"
        )}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

