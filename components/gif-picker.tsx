'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

interface TenorGif {
  id: string;
  media_formats: {
    tinygif: {
      url: string;
      dims: [number, number];
    };
    gif: {
      url: string;
      dims: [number, number];
    };
  };
  content_description: string;
}

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const TENOR_API_KEY = process.env.NEXT_PUBLIC_TENOR_API_KEY;

  // Fetch featured/trending GIFs on mount
  useEffect(() => {
    fetchFeatured();
  }, []);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const fetchFeatured = async () => {
    if (!TENOR_API_KEY) {
      setError('Tenor API key not configured');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&client_key=consensus_app&limit=20&contentfilter=medium`
      );
      const data = await res.json();
      setGifs(data.results || []);
    } catch (err) {
      console.error('Error fetching featured GIFs:', err);
      setError('Failed to load GIFs');
    }
    setLoading(false);
  };

  const searchGifs = useCallback(async (searchQuery: string) => {
    if (!TENOR_API_KEY) return;
    if (!searchQuery.trim()) {
      fetchFeatured();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://tenor.googleapis.com/v2/search?key=${TENOR_API_KEY}&client_key=consensus_app&q=${encodeURIComponent(searchQuery)}&limit=20&contentfilter=medium`
      );
      const data = await res.json();
      setGifs(data.results || []);
    } catch (err) {
      console.error('Error searching GIFs:', err);
      setError('Failed to search GIFs');
    }
    setLoading(false);
  }, [TENOR_API_KEY]);

  const handleSearchChange = (value: string) => {
    setQuery(value);
    
    // Debounce search
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      searchGifs(value);
    }, 300);
  };

  const handleSelect = (gif: TenorGif) => {
    // Use tinygif for smaller file size in comments
    onSelect(gif.media_formats.tinygif.url);
    onClose();
  };

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-800 z-50 overflow-hidden"
      style={{ maxHeight: '350px' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-200 p-3 dark:border-zinc-700">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search GIFs..."
            className="w-full rounded-lg bg-zinc-100 py-2 pl-9 pr-3 text-base focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-700 dark:focus:ring-zinc-600"
            autoFocus
          />
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* GIF Grid */}
      <div className="overflow-y-auto p-2" style={{ maxHeight: '280px' }}>
        {loading && gifs.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-zinc-500">{error}</div>
        ) : gifs.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-500">No GIFs found</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => handleSelect(gif)}
                className={cn(
                  "relative overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-700",
                  "hover:ring-2 hover:ring-violet-500 transition-all"
                )}
                style={{
                  aspectRatio: `${gif.media_formats.tinygif.dims[0]} / ${gif.media_formats.tinygif.dims[1]}`,
                }}
              >
                <img
                  src={gif.media_formats.tinygif.url}
                  alt={gif.content_description}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Powered by Tenor attribution */}
      <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-700">
        <img
          src="https://www.gstatic.com/tenor/web/attribution/PB_tenor_logo_blue_horizontal.svg"
          alt="Powered by Tenor"
          className="h-4 opacity-60 dark:invert"
        />
      </div>
    </div>
  );
}
