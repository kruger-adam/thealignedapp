'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search as SearchIcon, X, Loader2, Clock, Bot, User } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  content: string;
  created_at: string;
  is_ai: boolean;
  is_anonymous: boolean;
  author_id: string | null;
  image_url: string | null;
}

export function Search() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setHasSearched(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
      } catch (err) {
        console.error('Search error:', err);
        setResults([]);
      }
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setIsOpen(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
    setHasSearched(false);
  }, []);

  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Search trigger button - compact icon style to match sort/filter */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 transition-colors hover:bg-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:bg-zinc-700"
        title="Search (⌘K)"
      >
        <SearchIcon className="h-4 w-4" />
      </button>

      {/* Search modal/dropdown */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[10vh] backdrop-blur-sm"
          onClick={handleClose}
        >
          <div 
            className="mx-4 w-full max-w-xl rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
              <SearchIcon className="h-5 w-5 text-zinc-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search questions..."
                className="flex-1 bg-transparent text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
              <button
                onClick={handleClose}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {!hasSearched && query.length < 2 && (
                <div className="px-4 py-8 text-center text-sm text-zinc-500">
                  Type at least 2 characters to search
                </div>
              )}

              {hasSearched && !isLoading && results.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-zinc-500">
                  No questions found for &quot;{query}&quot;
                </div>
              )}

              {results.length > 0 && (
                <div className="py-2">
                  {results.map((result) => (
                    <Link
                      key={result.id}
                      href={`/question/${result.id}`}
                      onClick={handleClose}
                      className="flex gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      {/* Thumbnail */}
                      {result.image_url ? (
                        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                          <Image
                            src={result.image_url}
                            alt=""
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                          {result.is_ai ? (
                            <Bot className="h-5 w-5 text-violet-500" />
                          ) : result.is_anonymous ? (
                            <User className="h-5 w-5 text-zinc-400" />
                          ) : (
                            <SearchIcon className="h-5 w-5 text-zinc-400" />
                          )}
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2">
                          {result.content}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimeAgo(result.created_at)}</span>
                          {result.is_ai && (
                            <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                              AI
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Footer - keyboard hints hidden on mobile */}
            <div className="hidden items-center justify-between border-t border-zinc-200 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-700 sm:flex">
              <span>
                <kbd className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">↵</kbd> to select
              </span>
              <span>
                <kbd className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">esc</kbd> to close
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

