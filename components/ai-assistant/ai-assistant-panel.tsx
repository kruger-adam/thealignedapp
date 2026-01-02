'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Bot, Send, X, Trash2, Sparkles } from 'lucide-react';
import { useAIAssistant, Message, AssistantContext } from './ai-assistant-provider';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

// Initial suggestion chips based on context (shown when no messages)
function getInitialSuggestions(context: AssistantContext): string[] {
  switch (context.page) {
    case 'question':
      return [
        'Why did people vote this way?',
        'Argue the other side',
        'Summarize the debate',
        'What does AI think?',
      ];
    case 'profile':
      if (context.profileId === 'ai') {
        return [
          'How do you decide your votes?',
          'What topics interest you?',
          'Surprise me with an insight',
        ];
      }
      return [
        'What do we agree on?',
        'Where do we differ?',
        'Compare our views',
        'What makes them unique?',
      ];
    case 'feed':
    default:
      return [
        'Help me create a question',
        'My voting patterns',
        'Recommend questions',
        'Who thinks like me?',
      ];
  }
}

// Smart follow-up suggestions based on conversation context
function getSmartFollowUps(messages: Message[], context: AssistantContext): string[] {
  if (messages.length === 0) return getInitialSuggestions(context);
  
  // Get the last few messages for context
  const recentMessages = messages.slice(-4);
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  
  const conversationText = recentMessages.map(m => m.content).join(' ').toLowerCase();
  const lastResponse = (lastAssistantMsg?.content || '').toLowerCase();
  const lastQuestion = (lastUserMsg?.content || '').toLowerCase();
  
  const suggestions: string[] = [];
  
  // Detect topics discussed and suggest relevant follow-ups
  
  // If they discussed similar users
  if (lastResponse.includes('@') || conversationText.includes('similar') || conversationText.includes('thinks like')) {
    suggestions.push('Tell me more about them');
    suggestions.push('Where do we disagree?');
  }
  
  // If they discussed controversial/minority votes
  if (conversationText.includes('controversial') || conversationText.includes('minority') || conversationText.includes('disagree')) {
    suggestions.push('Why do I think differently?');
    suggestions.push('Find more like this');
  }
  
  // If they discussed voting patterns or streaks
  if (conversationText.includes('streak') || conversationText.includes('active') || conversationText.includes('pattern')) {
    suggestions.push('What are my controversial votes?');
    suggestions.push('Who votes like me?');
  }
  
  // If they discussed recommendations
  if (conversationText.includes('recommend') || conversationText.includes('vote on') || conversationText.includes('question')) {
    suggestions.push('Show me more questions');
    suggestions.push('Something more controversial');
  }
  
  // If on a question page
  if (context.page === 'question') {
    if (!conversationText.includes('other side') && !conversationText.includes('argue')) {
      suggestions.push('Argue the other side');
    }
    if (!conversationText.includes('why')) {
      suggestions.push('Why did people vote this way?');
    }
  }
  
  // If on a profile page
  if (context.page === 'profile' && context.profileId !== 'ai') {
    if (!conversationText.includes('agree')) {
      suggestions.push('What do we agree on?');
    }
    if (!conversationText.includes('differ') && !conversationText.includes('disagree')) {
      suggestions.push('Where do we differ?');
    }
  }
  
  // General follow-ups based on response content
  if (lastResponse.includes('streak')) {
    suggestions.push('How can I improve?');
  }
  if (lastResponse.includes('%')) {
    suggestions.push('What does this say about me?');
  }
  
  // If they discussed question creation/brainstorming
  if (conversationText.includes('question') || conversationText.includes('ask') || conversationText.includes('create') || conversationText.includes('post')) {
    if (!conversationText.includes('improve')) {
      suggestions.push('Improve my question');
    }
    if (!conversationText.includes('more ideas')) {
      suggestions.push('Give me more ideas');
    }
    if (!conversationText.includes('different topic')) {
      suggestions.push('Try a different topic');
    }
  }
  
  // Always have some analytics options available
  if (suggestions.length < 3) {
    const analytics = [
      "Help me create a question",
      "What's my voting streak?",
      'Where am I in the minority?',
      'Recommend something new',
    ];
    for (const a of analytics) {
      if (!conversationText.includes(a.toLowerCase().slice(0, 10)) && suggestions.length < 4) {
        suggestions.push(a);
      }
    }
  }
  
  // Dedupe and limit
  const unique = [...new Set(suggestions)];
  return unique.slice(0, 4);
}

// Component to render parsed message content with clickable @mentions
function ParsedMessageContent({ 
  content, 
  userMap,
  closeAssistant,
}: { 
  content: string; 
  userMap: Map<string, string>;
  closeAssistant: () => void;
}) {
  if (!content) return null;

  // Parse content for @mentions
  const parts: React.ReactNode[] = [];
  const mentionRegex = /@(\w+)/g;
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    const username = match[1];
    const userId = userMap.get(username.toLowerCase());

    if (userId) {
      // Clickable mention with known user ID
      parts.push(
        <Link
          key={`mention-${match.index}`}
          href={`/profile/${userId}`}
          onClick={closeAssistant}
          className="font-medium text-violet-600 hover:text-violet-700 hover:underline dark:text-violet-400 dark:hover:text-violet-300"
        >
          @{username}
        </Link>
      );
    } else {
      // Non-clickable mention (unknown user)
      parts.push(
        <span key={`mention-${match.index}`} className="font-medium text-violet-600 dark:text-violet-400">
          @{username}
        </span>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return <>{parts}</>;
}

function MessageBubble({ 
  message, 
  userMap,
  closeAssistant,
}: { 
  message: Message; 
  userMap: Map<string, string>;
  closeAssistant: () => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}

      {/* Message content */}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
          isUser
            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
            : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
        )}
      >
        {message.content ? (
          <ParsedMessageContent 
            content={message.content} 
            userMap={userMap}
            closeAssistant={closeAssistant}
          />
        ) : (
          <span className="inline-flex items-center gap-1 text-zinc-400">
            <span className="animate-pulse">●</span>
            <span className="animate-pulse animation-delay-150">●</span>
            <span className="animate-pulse animation-delay-300">●</span>
          </span>
        )}
      </div>
    </div>
  );
}

function QuickSuggestionChips({
  suggestions,
  onSelect,
  disabled,
}: {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          onClick={() => onSelect(suggestion)}
          disabled={disabled}
          className={cn(
            'rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700',
            'transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700',
            'dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
            'dark:hover:border-violet-600 dark:hover:bg-violet-950/50 dark:hover:text-violet-300',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}

export function AIAssistantPanel() {
  const { user } = useAuth();
  const {
    isOpen,
    isClosing,
    messages,
    isLoading,
    proactiveInsight,
    isLoadingInsight,
    currentContext,
    closeAssistant,
    sendMessage,
    clearMessages,
  } = useAIAssistant();

  const [inputValue, setInputValue] = useState('');
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const supabase = useMemo(() => createClient(), []);

  // Sheet drag state for mobile
  const [sheetHeight, setSheetHeight] = useState(60); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const initialSuggestions = getInitialSuggestions(currentContext);
  const smartFollowUps = getSmartFollowUps(messages, currentContext);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Extract @mentions from messages and fetch user IDs
  useEffect(() => {
    const mentionRegex = /@(\w+)/g;
    const mentionedUsernames = new Set<string>();
    
    messages.forEach(m => {
      let match;
      while ((match = mentionRegex.exec(m.content)) !== null) {
        mentionedUsernames.add(match[1].toLowerCase());
      }
    });

    // Filter out usernames we already have
    const unknownUsernames = [...mentionedUsernames].filter(u => !userMap.has(u));
    
    if (unknownUsernames.length === 0) return;

    // Fetch user IDs for unknown usernames
    const fetchUserIds = async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('username', unknownUsernames);

      if (profiles && profiles.length > 0) {
        setUserMap(prev => {
          const newMap = new Map(prev);
          profiles.forEach(p => {
            if (p.username) {
              newMap.set(p.username.toLowerCase(), p.id);
            }
          });
          return newMap;
        });
      }
    };

    fetchUserIds();
  }, [messages, supabase, userMap]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset sheet height when opened
  useEffect(() => {
    if (isOpen) {
      setSheetHeight(60);
    }
  }, [isOpen]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    sendMessage(inputValue);
    setInputValue('');
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  // Mobile drag handlers
  const handleDragStart = useCallback((clientY: number) => {
    setIsDragging(true);
    dragStartY.current = clientY;
    dragStartHeight.current = sheetHeight;
  }, [sheetHeight]);

  const handleDragMove = useCallback((clientY: number) => {
    if (!isDragging) return;
    
    const deltaY = dragStartY.current - clientY;
    const deltaPercent = (deltaY / window.innerHeight) * 100;
    const newHeight = Math.min(95, Math.max(30, dragStartHeight.current + deltaPercent));
    setSheetHeight(newHeight);
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    // Snap to thresholds
    if (sheetHeight < 35) {
      closeAssistant();
    } else if (sheetHeight < 55) {
      setSheetHeight(60);
    } else if (sheetHeight > 80) {
      setSheetHeight(95);
    }
  }, [sheetHeight, closeAssistant]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Mouse handlers for testing on desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    handleDragStart(e.clientY);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientY);
    };

    const handleMouseUp = () => {
      handleDragEnd();
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  if (!user || !isOpen) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 lg:hidden',
          isClosing ? 'animate-genie-backdrop-out' : 'animate-genie-backdrop-in'
        )}
        onClick={closeAssistant}
      />

      {/* Mobile: Bottom Sheet */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex flex-col bg-white shadow-2xl lg:hidden',
          'dark:bg-zinc-900',
          isClosing ? 'animate-genie-close-mobile' : 'animate-genie-open-mobile',
          isDragging ? '' : 'transition-[height] duration-200'
        )}
        style={{ height: `${sheetHeight}dvh` }}
      >
        {/* Drag handle */}
        <div
          className="flex h-8 cursor-grab items-center justify-center active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                AI Assistant
              </h2>
              <p className="text-xs text-zinc-500">Ask me anything</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={closeAssistant}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/30 dark:to-indigo-900/30">
                {isLoadingInsight ? (
                  <Bot className="h-8 w-8 text-violet-500 animate-pulse" />
                ) : (
                  <Sparkles className="h-8 w-8 text-violet-500" />
                )}
              </div>
              <div>
                {isLoadingInsight ? (
                  <p className="text-sm text-zinc-500 animate-pulse">Getting your insights...</p>
                ) : proactiveInsight ? (
                  <div className="max-w-xs rounded-2xl bg-zinc-100 px-4 py-3 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                    {proactiveInsight}
                  </div>
                ) : (
                  <>
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                      How can I help?
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      Ask about your voting patterns, get recommendations, or explore insights.
                    </p>
                  </>
                )}
              </div>
              <QuickSuggestionChips
                suggestions={initialSuggestions}
                onSelect={sendMessage}
                disabled={isLoading || isLoadingInsight}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  userMap={userMap}
                  closeAssistant={closeAssistant}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Smart follow-up suggestions based on conversation */}
        {messages.length > 0 && !isLoading && (
          <div className="border-t border-zinc-100 px-4 py-2 dark:border-zinc-800">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              Follow up
            </div>
            <QuickSuggestionChips
              suggestions={smartFollowUps}
              onSelect={sendMessage}
              disabled={isLoading}
            />
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 border-t border-zinc-100 p-4 dark:border-zinc-800"
        >
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            rows={1}
            className={cn(
              'flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base',
              'placeholder:text-zinc-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100',
              'dark:border-zinc-700 dark:bg-zinc-800 dark:placeholder:text-zinc-500',
              'dark:focus:border-violet-600 dark:focus:ring-violet-900/50'
            )}
            style={{ maxHeight: '120px' }}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-xl',
              'bg-gradient-to-br from-violet-500 to-indigo-600 text-white',
              'transition-all hover:from-violet-600 hover:to-indigo-700',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>

      {/* Desktop: Side Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-40 hidden h-full w-[420px] flex-col border-l border-zinc-200 bg-white shadow-xl lg:flex',
          'dark:border-zinc-800 dark:bg-zinc-900',
          isClosing ? 'animate-genie-close-desktop' : 'animate-genie-open-desktop'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
                AI Assistant
              </h2>
              <p className="text-xs text-zinc-500">Ask me anything about Aligned</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={closeAssistant}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/30 dark:to-indigo-900/30">
                {isLoadingInsight ? (
                  <Bot className="h-10 w-10 text-violet-500 animate-pulse" />
                ) : (
                  <Sparkles className="h-10 w-10 text-violet-500" />
                )}
              </div>
              <div>
                {isLoadingInsight ? (
                  <p className="text-sm text-zinc-500 animate-pulse">Getting your insights...</p>
                ) : proactiveInsight ? (
                  <div className="max-w-sm rounded-2xl bg-zinc-100 px-4 py-3 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                    {proactiveInsight}
                  </div>
                ) : (
                  <>
                    <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                      How can I help?
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      Ask about your voting patterns, get recommendations, or explore insights.
                    </p>
                  </>
                )}
              </div>
              <QuickSuggestionChips
                suggestions={initialSuggestions}
                onSelect={sendMessage}
                disabled={isLoading || isLoadingInsight}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  userMap={userMap}
                  closeAssistant={closeAssistant}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Smart follow-up suggestions based on conversation */}
        {messages.length > 0 && !isLoading && (
          <div className="border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              Follow up
            </div>
            <QuickSuggestionChips
              suggestions={smartFollowUps}
              onSelect={sendMessage}
              disabled={isLoading}
            />
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-3 border-t border-zinc-100 p-5 dark:border-zinc-800"
        >
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            rows={1}
            className={cn(
              'flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base',
              'placeholder:text-zinc-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100',
              'dark:border-zinc-700 dark:bg-zinc-800 dark:placeholder:text-zinc-500',
              'dark:focus:border-violet-600 dark:focus:ring-violet-900/50'
            )}
            style={{ maxHeight: '120px' }}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-xl',
              'bg-gradient-to-br from-violet-500 to-indigo-600 text-white',
              'transition-all hover:from-violet-600 hover:to-indigo-700',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </>
  );
}

