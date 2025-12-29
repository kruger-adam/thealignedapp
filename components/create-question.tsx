'use client';

import { useState, useMemo } from 'react';
import { Plus, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface CreateQuestionProps {
  onQuestionCreated?: () => void;
}

export function CreateQuestion({ onQuestionCreated }: CreateQuestionProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const charCount = content.length;
  const maxChars = 280;
  const isOverLimit = charCount > maxChars;
  const isValid = content.trim().length > 0 && !isOverLimit;

  const handleSubmit = async () => {
    if (!user || !isValid || isLoading) return;

    setIsLoading(true);
    
    // Get category from LLM
    let category = 'Other';
    try {
      const categoryRes = await fetch('/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: content.trim() }),
      });
      const categoryData = await categoryRes.json();
      category = categoryData.category || 'Other';
    } catch (err) {
      console.error('Error categorizing question:', err);
    }
    
    const { data: newQuestion, error } = await supabase
      .from('questions')
      .insert({
        author_id: user.id,
        content: content.trim(),
        category,
      })
      .select('id')
      .single();

    if (error || !newQuestion) {
      console.error('Error creating question:', error);
      setIsLoading(false);
      return;
    }

    // Notify followers about the new question
    const { data: followers } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', user.id);

    if (followers && followers.length > 0) {
      const notifications = followers.map(f => ({
        user_id: f.follower_id,
        type: 'new_question' as const,
        actor_id: user.id,
        question_id: newQuestion.id,
      }));
      
      supabase.from('notifications').insert(notifications).then(({ error: notifError }) => {
        if (notifError) console.error('Error creating notifications:', notifError);
      });
    }

    setContent('');
    setIsExpanded(false);
    setIsLoading(false);
    onQuestionCreated?.();
  };

  if (!user) {
    return (
      <Card className="border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50">
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-sm text-zinc-500">
            Sign in to create questions and vote
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        isExpanded
          ? 'ring-2 ring-zinc-900/10 dark:ring-zinc-100/10'
          : 'border-dashed hover:border-solid'
      )}
    >
      <CardContent className="p-4">
        {!isExpanded ? (
          <button
            onClick={() => setIsExpanded(true)}
            className="flex w-full items-center gap-3 text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <Plus className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
            </div>
            <span className="text-zinc-500">
              Ask a yes/no question...
            </span>
          </button>
        ) : (
          <div className="space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's your yes/no question?"
              className="min-h-[100px] w-full resize-none bg-transparent text-lg placeholder:text-zinc-400 focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey && isValid) {
                  handleSubmit();
                }
              }}
            />
            
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  'text-sm',
                  isOverLimit
                    ? 'text-rose-500'
                    : charCount > maxChars * 0.8
                    ? 'text-amber-500'
                    : 'text-zinc-400'
                )}
              >
                {charCount}/{maxChars}
              </span>
              
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setContent('');
                    setIsExpanded(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!isValid || isLoading}
                  className="gap-1.5"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Post
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


