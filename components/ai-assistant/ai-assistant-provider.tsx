'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AIAssistantContextType {
  isOpen: boolean;
  isClosing: boolean;
  messages: Message[];
  isLoading: boolean;
  proactiveInsight: string | null;
  isLoadingInsight: boolean;
  currentContext: AssistantContext;
  openAssistant: () => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}

export interface AssistantContext {
  page: 'feed' | 'question' | 'profile' | 'other';
  questionId?: string;
  profileId?: string;
}

const AIAssistantContext = createContext<AIAssistantContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'ai-assistant-messages';

// Duration for genie close animation (matches CSS)
const GENIE_CLOSE_DURATION = 350;

export function AIAssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [proactiveInsight, setProactiveInsight] = useState<string | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  const [insightFetched, setInsightFetched] = useState(false);
  const pathname = usePathname();

  // Derive context from current route
  const currentContext: AssistantContext = (() => {
    if (pathname === '/' || pathname === '') {
      return { page: 'feed' as const };
    }
    if (pathname.startsWith('/question/')) {
      const questionId = pathname.split('/')[2];
      return { page: 'question' as const, questionId };
    }
    if (pathname.startsWith('/profile/')) {
      const profileId = pathname.split('/')[2];
      return { page: 'profile' as const, profileId };
    }
    return { page: 'other' as const };
  })();

  // Load messages from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        const messagesWithDates = parsed.map((m: Message & { timestamp: string }) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
        setMessages(messagesWithDates);
      }
    } catch {
      // Ignore parsing errors
    }
  }, []);

  // Save messages to sessionStorage when they change
  useEffect(() => {
    if (messages.length > 0) {
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(messages));
      } catch {
        // Ignore storage errors
      }
    }
  }, [messages]);

  // Fetch proactive insight when panel opens (if no messages yet)
  useEffect(() => {
    if (isOpen && messages.length === 0 && !insightFetched && !isLoadingInsight) {
      setIsLoadingInsight(true);
      fetch('/api/ai-assistant/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: currentContext }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.insight) {
            setProactiveInsight(data.insight);
          }
        })
        .catch(err => {
          console.error('Failed to fetch insight:', err);
        })
        .finally(() => {
          setIsLoadingInsight(false);
          setInsightFetched(true);
        });
    }
  }, [isOpen, messages.length, insightFetched, isLoadingInsight, currentContext]);

  // Reset insight when messages are cleared
  const clearMessages = useCallback(() => {
    setMessages([]);
    setProactiveInsight(null);
    setInsightFetched(false);
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const openAssistant = useCallback(() => {
    setIsClosing(false);
    setIsOpen(true);
  }, []);
  
  const closeAssistant = useCallback(() => {
    setIsClosing(true);
    // Wait for genie animation to complete before actually closing
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, GENIE_CLOSE_DURATION);
  }, []);
  
  const toggleAssistant = useCallback(() => {
    if (isOpen) {
      closeAssistant();
    } else {
      openAssistant();
    }
  }, [isOpen, closeAssistant, openAssistant]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Create placeholder for assistant message
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content.trim(),
          context: currentContext,
          history: messages.slice(-10), // Send last 10 messages for context
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;

        // Update the assistant message with streamed content
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessageId
              ? { ...m, content: fullContent }
              : m
          )
        );
      }
    } catch (error) {
      console.error('AI Assistant error:', error);
      // Update with error message
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMessageId
            ? { ...m, content: "Sorry, I couldn't respond right now. Please try again." }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, currentContext, messages]);

  return (
    <AIAssistantContext.Provider
      value={{
        isOpen,
        isClosing,
        messages,
        isLoading,
        proactiveInsight,
        isLoadingInsight,
        currentContext,
        openAssistant,
        closeAssistant,
        toggleAssistant,
        sendMessage,
        clearMessages,
      }}
    >
      {children}
    </AIAssistantContext.Provider>
  );
}

export function useAIAssistant() {
  const context = useContext(AIAssistantContext);
  if (context === undefined) {
    throw new Error('useAIAssistant must be used within an AIAssistantProvider');
  }
  return context;
}

