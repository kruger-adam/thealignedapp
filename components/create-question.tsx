'use client';

import { useState, useMemo, useCallback } from 'react';
import { Plus, Send, Loader2, Lock, Unlock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { triggerInstallPrompt } from '@/components/install-prompt';

interface CreateQuestionProps {
  onQuestionCreated?: () => void;
}

const topicPrompts = {
  '🤔 Hypothetical': [
    'Would you move to another country for your dream job?',
    'Would you give up social media forever for $1 million?',
    'Would you rather know the date of your death or the cause?',
    'Would you take a one-way trip to Mars?',
    'Would you live in a simulation if it meant eternal happiness?',
    'Would you choose to know everyone\'s true thoughts about you?',
    'Would you restart life from age 10 with all your current knowledge?',
    'Would you accept immortality if it meant outliving everyone you love?',
  ],
  '💭 Ethics': [
    'Is it ever okay to lie to protect someone?',
    'Should billionaires be taxed more heavily?',
    'Is it ethical to eat meat?',
    'Should AI be allowed to make life-or-death decisions?',
    'Is privacy more important than security?',
    'Is it wrong to ghost someone instead of rejecting them directly?',
    'Should parents be allowed to genetically modify their children?',
    'Is it okay to pirate content from billion-dollar companies?',
  ],
  '❤️ Relationships': [
    'Is it okay to stay friends with an ex?',
    'Should couples share passwords?',
    'Is long-distance worth it?',
    'Should you tell a friend if their partner is cheating?',
    'Is it better to marry your best friend or someone you have chemistry with?',
    'Is it a red flag if someone has no close friends?',
    'Should you split the bill on a first date?',
    'Is it okay to go through your partner\'s phone if you suspect something?',
  ],
  '💼 Work & Career': [
    'Is work-life balance actually achievable?',
    'Should you follow your passion or the money?',
    'Is college worth it anymore?',
    'Would you take a 50% pay cut for a job you love?',
    'Is it better to rent or buy a home?',
    'Should you ever accept a counteroffer from your current employer?',
    'Is remote work better than office work?',
    'Should you stay at a job you hate for financial security?',
  ],
  '🎮 Fun & Silly': [
    'Is a hot dog a sandwich?',
    'Should pineapple go on pizza?',
    'Is water wet?',
    'Would you rather fight 100 duck-sized horses or 1 horse-sized duck?',
    'Is cereal a soup?',
    'Does the person who sleeps closest to the door have to fight the intruder?',
    'Is a Pop-Tart a ravioli?',
    'Would you eat a bug for $100?',
  ],
  '🗳️ Society': [
    'Should voting be mandatory?',
    'Is democracy the best form of government?',
    'Should there be term limits for all politicians?',
    'Is political correctness helping or hurting society?',
    'Should the voting age be lowered to 16?',
    'Should billionaires exist?',
    'Is cancel culture a net positive for society?',
    'Should there be limits on free speech?',
  ],
  '🧠 Technology': [
    'Will AI take most jobs within 20 years?',
    'Should social media have age verification?',
    'Is it ethical to date someone you met through AI matchmaking?',
    'Should we colonize Mars before fixing Earth?',
    'Would you get a brain chip implant for enhanced memory?',
    'Should autonomous weapons be banned?',
    'Is it okay to use AI to write work emails?',
    'Should there be a universal right to internet access?',
  ],
  '🏃 Health & Wellness': [
    'Is it okay to lie about your fitness routine?',
    'Should junk food be taxed like cigarettes?',
    'Is 8 hours of sleep really necessary?',
    'Would you take a pill that makes you happy but slightly shortens your life?',
    'Is mental health day just as valid as a sick day?',
    'Should employers be required to provide gym memberships?',
    'Is it okay to judge people for their eating habits?',
    'Would you give up coffee forever for better sleep?',
  ],
  '🎬 Entertainment': [
    'Are remakes ever better than the original?',
    'Should movie theaters serve full meals?',
    'Is binge-watching unhealthy?',
    'Should artists separate their art from their personal behavior?',
    'Is reading books superior to watching movies?',
    'Should spoilers have a statute of limitations?',
    'Is vinyl actually better than digital music?',
    'Would you rather never watch new movies or never rewatch old favorites?',
  ],
  '🌍 Environment': [
    'Should single-use plastics be completely banned?',
    'Would you give up meat to save the environment?',
    'Is nuclear power the solution to climate change?',
    'Should companies be legally required to offset their carbon footprint?',
    'Would you pay 20% more for all products if they were sustainable?',
    'Is individual action meaningless compared to corporate responsibility?',
    'Should flying be heavily taxed to reduce emissions?',
    'Would you live without air conditioning to reduce energy use?',
  ],
};

type TopicKey = keyof typeof topicPrompts;

export function CreateQuestion({ onQuestionCreated }: CreateQuestionProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const charCount = content.length;
  const maxChars = 280;
  const isOverLimit = charCount > maxChars;
  const isValid = content.trim().length > 0 && !isOverLimit;

  const getRandomPrompt = useCallback((topic: TopicKey) => {
    const prompts = topicPrompts[topic];
    const randomIndex = Math.floor(Math.random() * prompts.length);
    setContent(prompts[randomIndex]);
  }, []);

  const handleSubmit = async () => {
    if (!user || !isValid || isLoading) return;

    setIsLoading(true);
    const questionContent = content.trim();
    
    // Insert question immediately with default category
    const { data: newQuestion, error } = await supabase
      .from('questions')
      .insert({
        author_id: user.id,
        content: questionContent,
        category: 'Other', // Default, will be updated async
        is_anonymous: isAnonymous,
      })
      .select('id')
      .single();

    if (error || !newQuestion) {
        console.error('Error creating question:', error);
      setIsLoading(false);
        return;
      }

    // Reset form immediately - don't wait for categorization or notifications
    const wasAnonymous = isAnonymous;
      setContent('');
      setIsExpanded(false);
    setIsLoading(false);
    setIsAnonymous(false);
    onQuestionCreated?.();

    // Trigger install prompt after creating a question
    triggerInstallPrompt();

    // Categorize in background (fire and forget)
    fetch('/api/categorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: questionContent }),
    })
      .then(res => res.json())
      .then(data => {
        const category = data.category || 'Other';
        if (category !== 'Other') {
          supabase
            .from('questions')
            .update({ category })
            .eq('id', newQuestion.id)
            .then(({ error: updateError }) => {
              if (updateError) console.error('Error updating category:', updateError);
            });
        }
      })
      .catch(err => console.error('Error categorizing question:', err));

    // AI votes on the question in background, then refresh to show the vote
    fetch('/api/ai-vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        questionId: newQuestion.id,
        questionContent: questionContent,
        authorId: user.id,
      }),
    })
      .then(() => {
        // Refresh questions to show AI vote
      onQuestionCreated?.();
      })
      .catch(err => console.error('Error getting AI vote:', err));

    // Generate AI image in background (fire and forget)
    fetch('/api/ai-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: newQuestion.id,
        questionContent: questionContent,
      }),
    })
      .then(() => {
        // Refresh questions to show image
        onQuestionCreated?.();
      })
      .catch(err => console.error('Error generating image:', err));

    // Notify followers in background (fire and forget) - skip for anonymous posts
    if (!wasAnonymous) {
      supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', user.id)
        .then(({ data: followers }) => {
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
        });
    }
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

            {/* Topic inspiration chips */}
            <div className="flex flex-wrap items-center gap-1.5 pb-2">
              <Sparkles className="h-3.5 w-3.5 text-zinc-400" />
              {(Object.keys(topicPrompts) as TopicKey[]).map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => getRandomPrompt(topic)}
                  className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                >
                  {topic}
                </button>
              ))}
            </div>
            
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
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAnonymous(!isAnonymous)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors",
                    isAnonymous
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  )}
                  title={isAnonymous ? "Posting anonymously" : "Post anonymously"}
                >
                  {isAnonymous ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    <Unlock className="h-3 w-3" />
                  )}
                  {isAnonymous ? "Anonymous" : "Public"}
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setContent('');
                    setIsExpanded(false);
                    setIsAnonymous(false);
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


