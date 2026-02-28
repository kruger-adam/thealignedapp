'use client';

import { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { Category } from '@/lib/types';
import { cn } from '@/lib/utils';

const CATEGORIES: { value: Category; emoji: string; description: string }[] = [
  { value: 'LessWrong', emoji: '🦉', description: 'Rationality & reasoning' },
  { value: 'EA Forum', emoji: '🌐', description: 'Effective altruism' },
  { value: "Lenny's Podcast", emoji: '🎙️', description: 'Product & startups' },
  { value: 'Open to Debate', emoji: '🎤', description: 'Civil discourse' },
  { value: 'Future of Life', emoji: '🔬', description: 'AI & existential risk' },
  { value: 'Hypothetical', emoji: '🤔', description: 'What if scenarios' },
  { value: 'Ethics', emoji: '⚖️', description: 'Right vs wrong' },
  { value: 'Relationships', emoji: '💕', description: 'Love & connection' },
  { value: 'Work & Career', emoji: '💼', description: 'Professional life' },
  { value: 'Fun & Silly', emoji: '🎉', description: 'Just for laughs' },
  { value: 'Politics & Society', emoji: '🗳️', description: 'Governance & how we live' },
  { value: 'Technology', emoji: '🤖', description: 'Tech & innovation' },
  { value: 'Health & Wellness', emoji: '🧘', description: 'Mind & body' },
  { value: 'Entertainment', emoji: '🎬', description: 'Movies, music & more' },
  { value: 'Environment', emoji: '🌍', description: 'Our planet' },
  { value: 'Product Management', emoji: '📊', description: 'Building products' },
  { value: 'Sports', emoji: '⚽', description: 'Games & competition' },
  { value: 'Food & Lifestyle', emoji: '🍕', description: 'How we live' },
];

interface CategoryPickerProps {
  onSelect: (category: Category) => void;
  onDismiss: () => void;
}

export function CategoryPicker({ onSelect, onDismiss }: CategoryPickerProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isExiting, setIsExiting] = useState(false);

  const handleSelect = (category: Category) => {
    setSelectedCategory(category);
  };

  const handleConfirm = () => {
    if (selectedCategory) {
      setIsExiting(true);
      setTimeout(() => {
        onSelect(selectedCategory);
      }, 300);
    }
  };

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss();
    }, 300);
  };

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity duration-300",
        isExiting ? "opacity-0" : "opacity-100"
      )}
    >
      <div 
        className={cn(
          "relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 shadow-2xl transition-all duration-300",
          isExiting ? "scale-95 opacity-0" : "scale-100 opacity-100"
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-b from-zinc-900 to-transparent px-6 pt-6 pb-4">
          <button
            onClick={handleDismiss}
            className="absolute right-4 top-4 rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Welcome! 👋</h2>
              <p className="text-sm text-zinc-400">Let&apos;s get you started</p>
            </div>
          </div>
          
          <p className="text-zinc-300 mt-4">
            Pick a topic that interests you, vote on <span className="font-semibold text-violet-400">10 polls</span>, 
            and see how your views compare with our AI.
          </p>
        </div>

        {/* Categories Grid */}
        <div className="px-6 pb-4 overflow-y-auto max-h-[50vh]">
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map(({ value, emoji, description }) => (
              <button
                key={value}
                onClick={() => handleSelect(value)}
                className={cn(
                  "flex flex-col items-start p-4 rounded-2xl border-2 transition-all duration-200 text-left",
                  selectedCategory === value
                    ? "border-violet-500 bg-violet-500/20 scale-[1.02]"
                    : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600 hover:bg-zinc-800"
                )}
              >
                <span className="text-2xl mb-2">{emoji}</span>
                <span className="font-semibold text-white text-sm">{value}</span>
                <span className="text-xs text-zinc-400 mt-0.5">{description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gradient-to-t from-zinc-900 via-zinc-900 to-transparent px-6 py-6">
          <button
            onClick={handleConfirm}
            disabled={!selectedCategory}
            className={cn(
              "w-full py-4 rounded-2xl font-semibold text-lg transition-all duration-200",
              selectedCategory
                ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600 shadow-lg shadow-violet-500/25"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            )}
          >
            {selectedCategory ? `Let's go! →` : 'Pick a category'}
          </button>
          
          <button
            onClick={handleDismiss}
            className="w-full mt-3 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

