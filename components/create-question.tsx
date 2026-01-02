'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Plus, Send, Loader2, Lock, Unlock, Sparkles, Clock, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { triggerInstallPrompt } from '@/components/install-prompt';
import { useToast } from '@/components/ui/toast';
import { useAIAssistant } from '@/components/ai-assistant';

// Confetti colors for celebration
const CONFETTI_COLORS = [
  '#10b981', '#34d399', '#6ee7b7', // Emerald
  '#14b8a6', '#2dd4bf', '#5eead4', // Teal
  '#f59e0b', '#fbbf24', '#fcd34d', // Amber
  '#ec4899', '#f472b6', '#f9a8d4', // Pink
  '#8b5cf6', '#a78bfa', '#c4b5fd', // Violet
];

interface CreateQuestionProps {
  onQuestionCreated?: () => void;
}

const topicPrompts = {
  '🤔 Hypothetical': [
    'Would you move to another country for your dream job?',
    'Would you give up social media forever for $1 million?',
    'Would you want to know the exact date of your death?',
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
    'Is friendship more important than chemistry in a relationship?',
    'Is it a red flag if someone has no close friends?',
    'Should you split the bill on a first date?',
    'Is it okay to go through your partner\'s phone if you suspect something?',
  ],
  '💼 Work & Career': [
    'Is work-life balance actually achievable?',
    'Should you follow your passion over the money?',
    'Is college worth it anymore?',
    'Would you take a 50% pay cut for a job you love?',
    'Is buying a home worth it in today\'s market?',
    'Should you ever accept a counteroffer from your current employer?',
    'Is remote work better than office work?',
    'Should you stay at a job you hate for financial security?',
  ],
  '🎮 Fun & Silly': [
    'Is a hot dog a sandwich?',
    'Should pineapple go on pizza?',
    'Is water wet?',
    'Could you beat a goose in a fight?',
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
  '🏛️ Politics': [
    'Should voting be mandatory?',
    'Is democracy the best form of government?',
    'Should there be term limits for all politicians?',
    'Should the voting age be lowered to 16?',
    'Is a two-party system fundamentally broken?',
    'Should corporations be allowed to donate to political campaigns?',
    'Is nationalism ever a good thing?',
    'Should politicians be required to pass a competency test?',
  ],
};

// Default/fallback prompts (used if DB fetch fails)
const defaultTopicPrompts = topicPrompts;

type TopicKey = keyof typeof topicPrompts;

// Flatten all prompts for typewriter animation
const allPromptsBase = Object.values(topicPrompts).flat();

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function CreateQuestion({ onQuestionCreated }: CreateQuestionProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { openAssistant, sendMessage } = useAIAssistant();
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [hasExpiration, setHasExpiration] = useState(false);
  const [expirationHours, setExpirationHours] = useState<number | null>(null); // null = no expiration
  const [dynamicPrompts, setDynamicPrompts] = useState<Record<string, string[]> | null>(null);
  const supabase = useMemo(() => createClient(), []);
  
  // Handle opening AI assistant for brainstorming
  const handleAIBrainstorm = useCallback(() => {
    openAssistant();
    // Send a brainstorming prompt with any existing content
    if (content.trim()) {
      sendMessage(`Help me improve this question idea: "${content.trim()}"`);
    } else {
      sendMessage('Help me brainstorm a great question to post. What topics would spark interesting debates?');
    }
  }, [openAssistant, sendMessage, content]);
  
  // Animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const [confettiParticles, setConfettiParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    rotation: number;
    color: string;
    size: number;
    shape: 'circle' | 'square' | 'triangle';
  }>>([]);
  const postButtonRef = useRef<HTMLButtonElement>(null);
  
  // Trigger haptic feedback
  const triggerHaptic = useCallback((duration: number = 10) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(duration);
    }
  }, []);
  
  // Spawn celebration confetti
  const spawnCelebrationConfetti = useCallback(() => {
    const buttonRect = postButtonRef.current?.getBoundingClientRect();
    if (!buttonRect) return;
    
    const centerX = buttonRect.left + buttonRect.width / 2;
    const centerY = buttonRect.top + buttonRect.height / 2;
    
    const particles = Array.from({ length: 30 }, (_, i) => {
      const angle = (i / 30) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const distance = 80 + Math.random() * 120;
      const shapes: Array<'circle' | 'square' | 'triangle'> = ['circle', 'square', 'triangle'];
      return {
        id: Date.now() + i,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance - 60, // Bias upward
        rotation: Math.random() * 720,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: 6 + Math.random() * 6,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
      };
    });
    
    setConfettiParticles(particles);
    
    // Clear particles after animation
    setTimeout(() => setConfettiParticles([]), 1000);
  }, []);
  
  // Shuffle prompts once per session for variety
  const shuffledPrompts = useMemo(() => shuffleArray(allPromptsBase), []);
  
  // Typewriter animation state
  const [questionIndex, setQuestionIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState(() => shuffledPrompts[0]?.[0] ?? ''); // Start with first char
  const [isTyping, setIsTyping] = useState(true);
  
  // Typewriter effect
  useEffect(() => {
    if (isExpanded) return; // Don't animate when expanded
    
    const currentQuestion = shuffledPrompts[questionIndex];
    let timeout: NodeJS.Timeout;
    
    if (isTyping) {
      // Typing forward
      if (displayedText.length < currentQuestion.length) {
        timeout = setTimeout(() => {
          setDisplayedText(currentQuestion.slice(0, displayedText.length + 1));
        }, 30 + Math.random() * 20); // Faster typing: 30-50ms per char
      } else {
        // Pause at end of word (0.5 seconds)
        timeout = setTimeout(() => {
          setIsTyping(false);
        }, 500);
      }
    } else {
      // Backspacing
      if (displayedText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayedText(displayedText.slice(0, -1));
        }, 15); // Faster backspace
      } else {
        // Move to next question immediately (no flash)
        const nextIndex = (questionIndex + 1) % shuffledPrompts.length;
        setQuestionIndex(nextIndex);
        setDisplayedText(shuffledPrompts[nextIndex].slice(0, 1)); // Start with first char
        setIsTyping(true);
      }
    }
    
    return () => clearTimeout(timeout);
  }, [displayedText, isTyping, questionIndex, isExpanded, shuffledPrompts]);

  const charCount = content.length;
  const maxChars = 280;
  const isOverLimit = charCount > maxChars;
  const isValid = content.trim().length > 0 && !isOverLimit;

  // Fetch dynamic prompts from DB on mount
  useEffect(() => {
    fetch('/api/prompts')
      .then(res => res.json())
      .then(data => {
        if (data.prompts && Object.keys(data.prompts).length > 0) {
          setDynamicPrompts(data.prompts);
        }
      })
      .catch(err => console.error('Error fetching prompts:', err));
  }, []);

  // Use dynamic prompts if available, otherwise fall back to defaults
  const activePrompts = useMemo(() => {
    if (!dynamicPrompts) return defaultTopicPrompts;
    
    // Merge dynamic prompts with defaults (dynamic takes priority)
    const merged: Record<string, string[]> = { ...defaultTopicPrompts };
    for (const [category, prompts] of Object.entries(dynamicPrompts)) {
      if (prompts.length > 0) {
        merged[category] = prompts;
      }
    }
    return merged;
  }, [dynamicPrompts]);

  const getRandomPrompt = useCallback((topic: TopicKey) => {
    const prompts = activePrompts[topic] || defaultTopicPrompts[topic];
    if (!prompts || prompts.length === 0) return;
    const randomIndex = Math.floor(Math.random() * prompts.length);
    setContent(prompts[randomIndex]);
  }, [activePrompts]);

  const handleSubmit = async () => {
    if (!user || !isValid || isLoading) return;

    // Trigger animations immediately for responsiveness
    triggerHaptic(15);
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 400);

    setIsLoading(true);
    const questionContent = content.trim();
    
    // Calculate expires_at if expiration is set
    let expiresAt: string | null = null;
    if (hasExpiration && expirationHours) {
      const expireDate = new Date();
      expireDate.setHours(expireDate.getHours() + expirationHours);
      expiresAt = expireDate.toISOString();
    }
    
    // Insert question immediately with default category
    const { data: newQuestion, error } = await supabase
      .from('questions')
      .insert({
        author_id: user.id,
        content: questionContent,
        category: 'Other', // Default, will be updated async
        is_anonymous: isAnonymous,
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (error || !newQuestion) {
        console.error('Error creating question:', error);
      setIsLoading(false);
      setIsAnimating(false);
        return;
      }

    // Success! Spawn confetti celebration
    spawnCelebrationConfetti();
    triggerHaptic(30); // Longer haptic for success

    // Reset form immediately - don't wait for categorization or notifications
    const wasAnonymous = isAnonymous;
      setContent('');
      setIsExpanded(false);
    setIsLoading(false);
    setIsAnonymous(false);
    setHasExpiration(false);
    setExpirationHours(null);
    
    // Show celebratory toast
    showToast('Question posted!', 'success');
    
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

    // Check if question matches a prompt and regenerate if needed (fire and forget)
    fetch('/api/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionContent }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.matched) {
          // Refetch prompts to get the updated list
          fetch('/api/prompts')
            .then(res => res.json())
            .then(promptsData => {
              if (promptsData.prompts) {
                setDynamicPrompts(promptsData.prompts);
              }
            });
        }
      })
      .catch(err => console.error('Error checking prompts:', err));

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
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <Plus className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
            </div>
            <span className="text-zinc-500">
              {displayedText}
              <span className="ml-0.5 inline-block w-0.5 h-4 bg-zinc-400 animate-pulse" />
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
              {/* AI Brainstorm button */}
              <button
                type="button"
                onClick={handleAIBrainstorm}
                className="rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-2.5 py-1 text-xs font-medium text-white transition-all hover:from-violet-600 hover:to-indigo-600 hover:shadow-md flex items-center gap-1"
              >
                <Bot className="h-3 w-3" />
                Ask AI
              </button>
            </div>
            
            {/* Options row: time limit and visibility */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Expiration toggle and options */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (hasExpiration) {
                      setHasExpiration(false);
                      setExpirationHours(null);
                    } else {
                      setHasExpiration(true);
                      setExpirationHours(24); // Default to 24h
                    }
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors",
                    hasExpiration
                      ? "bg-amber-500 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  )}
                  title={hasExpiration ? "Poll has time limit" : "Add time limit"}
                >
                  <Clock className="h-3 w-3" />
                  {hasExpiration ? (
                    expirationHours === 1 ? '1h' : 
                    expirationHours === 24 ? '24h' : 
                    expirationHours === 168 ? '1 week' : 
                    `${expirationHours}h`
                  ) : 'No limit'}
                </button>
                {hasExpiration && (
                  <div className="flex gap-0.5">
                    {[
                      { label: '1h', hours: 1 },
                      { label: '24h', hours: 24 },
                      { label: '1w', hours: 168 },
                    ].map(({ label, hours }) => (
                      <button
                        key={hours}
                        type="button"
                        onClick={() => setExpirationHours(hours)}
                        className={cn(
                          "rounded px-1.5 py-0.5 text-xs transition-colors",
                          expirationHours === hours
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                            : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
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
            </div>
            
            {/* Actions row: character count, cancel, post */}
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setContent('');
                    setIsExpanded(false);
                    setIsAnonymous(false);
                    setHasExpiration(false);
                    setExpirationHours(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  ref={postButtonRef}
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!isValid || isLoading}
                  className={cn(
                    "gap-1.5",
                    isAnimating && "animate-vote-pop"
                  )}
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
      
      {/* Celebration confetti particles */}
      {confettiParticles.map((particle) => (
        <span
          key={particle.id}
          className="confetti-burst-particle"
          style={{
            left: postButtonRef.current?.getBoundingClientRect().left ?? 0,
            top: postButtonRef.current?.getBoundingClientRect().top ?? 0,
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            borderRadius: particle.shape === 'circle' ? '50%' : particle.shape === 'triangle' ? '0' : '2px',
            clipPath: particle.shape === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : undefined,
            '--confetti-x': `${particle.x - (postButtonRef.current?.getBoundingClientRect().left ?? 0)}px`,
            '--confetti-y': `${particle.y - (postButtonRef.current?.getBoundingClientRect().top ?? 0)}px`,
            '--confetti-rotation': `${particle.rotation}deg`,
          } as React.CSSProperties}
        />
      ))}
    </Card>
  );
}


