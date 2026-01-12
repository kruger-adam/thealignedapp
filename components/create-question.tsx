'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Plus, Send, Loader2, Lock, Unlock, Sparkles, Clock, Bot, Wand2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
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
  '🔥 Hot Takes': [
    'Is having children selfish in today\'s world?',
    'Should inheritance be abolished?',
    'Are most people too stupid to vote?',
    'Is monogamy outdated?',
    'Should the rich be forced to fund climate solutions?',
    'Is religion doing more harm than good?',
    'Should there be a maximum wealth cap?',
    'Are influencers a net negative for society?',
  ],
  '🤔 Hypothetical': [
    'Would you betray your best friend for $10 million?',
    'Would you erase your ex from your memory if you could?',
    'Would you sacrifice one stranger to save five?',
    'Would you take a one-way trip to Mars?',
    'Would you give up all privacy for complete safety?',
    'Would you choose to know everyone\'s true thoughts about you?',
    'Would you restart life from age 10 with all your current knowledge?',
    'Would you accept immortality if it meant outliving everyone you love?',
  ],
  '💭 Ethics': [
    'Is it ever okay to lie to protect someone?',
    'Should billionaires be taxed at 90%?',
    'Is eating meat morally indefensible?',
    'Should AI be allowed to make life-or-death decisions?',
    'Is privacy more important than security?',
    'Is it okay to pirate content from billion-dollar companies?',
    'Should parents be allowed to genetically modify their children?',
    'Is cheating ever justified?',
  ],
  '❤️ Relationships': [
    'Is it a red flag if someone has never been in a long-term relationship?',
    'Should couples have access to each other\'s phones?',
    'Is staying together for the kids the right choice?',
    'Should you tell a friend if their partner is cheating?',
    'Is living together before marriage essential?',
    'Is it a red flag if someone has no close friends?',
    'Should the higher earner pay more of the bills?',
    'Is going through your partner\'s phone ever justified?',
  ],
  '💼 Work & Career': [
    'Is hustle culture toxic?',
    'Should you follow your passion even if it means being broke?',
    'Is college a scam?',
    'Should companies be forced to pay a living wage?',
    'Is buying a home a trap in today\'s economy?',
    'Should employers be able to monitor remote workers?',
    'Is remote work making people lazier?',
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
    'Are most people too easily offended today?',
    'Is democracy failing?',
    'Should there be term limits for all politicians?',
    'Is political correctness killing free speech?',
    'Should 16-year-olds be allowed to vote?',
    'Should billionaires exist?',
    'Is cancel culture out of control?',
    'Should there be limits on free speech?',
  ],
  '🧠 Technology': [
    'Will AI make most humans unemployable?',
    'Should kids under 16 be banned from social media?',
    'Is Big Tech more powerful than governments?',
    'Should we colonize Mars before fixing Earth?',
    'Would you get a brain chip implant for enhanced memory?',
    'Should autonomous weapons be banned?',
    'Is social media destroying mental health?',
    'Should there be a universal right to internet access?',
  ],
  '🏃 Health & Wellness': [
    'Should obese people pay more for health insurance?',
    'Should junk food be taxed like cigarettes?',
    'Is the fitness industry a scam?',
    'Would you take a pill that makes you happy but slightly shortens your life?',
    'Should mental health days be legally protected?',
    'Should drug use be completely decriminalized?',
    'Is it okay to judge people for their eating habits?',
    'Is therapy overrated?',
  ],
  '🎬 Entertainment': [
    'Are remakes ever better than the original?',
    'Is Marvel ruining cinema?',
    'Is binge-watching a form of addiction?',
    'Should we separate art from the artist?',
    'Are books actually superior to other media?',
    'Should spoilers have a statute of limitations?',
    'Is modern music worse than older generations?',
    'Are video games art?',
  ],
  '🌍 Environment': [
    'Should single-use plastics be completely banned?',
    'Is veganism the only ethical diet?',
    'Is nuclear power the only solution to climate change?',
    'Should polluting companies face criminal charges?',
    'Would you pay 50% more for everything if it saved the planet?',
    'Is individual action pointless compared to corporate responsibility?',
    'Should flying be heavily taxed to reduce emissions?',
    'Are climate activists doing more harm than good?',
  ],
  '🏛️ Politics': [
    'Is the political system beyond repair?',
    'Is democracy the best form of government?',
    'Should there be age limits for politicians?',
    'Should the voting age be lowered to 16?',
    'Is a two-party system fundamentally broken?',
    'Should money be banned from politics entirely?',
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
  const { user, signInWithGoogle } = useAuth();
  const { showToast } = useToast();
  const { openAssistant, sendMessage } = useAIAssistant();
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [hasExpiration, setHasExpiration] = useState(false);
  const [expirationHours, setExpirationHours] = useState<number | null>(null); // null = no expiration
  const [dynamicPrompts, setDynamicPrompts] = useState<Record<string, string[]> | null>(null);
  
  // Reword suggestion state
  const [isRewording, setIsRewording] = useState(false);
  const [rewordSuggestion, setRewordSuggestion] = useState<string | null>(null);
  
  // Handle AI reword request
  const handleReword = useCallback(async () => {
    if (!content.trim() || isRewording) return;
    
    setIsRewording(true);
    setRewordSuggestion(null);
    
    try {
      const response = await fetch('/api/ai-reword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content.trim(),
          type: 'question',
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        showToast(data.error || 'Failed to reword question', 'error');
        setIsRewording(false);
        return;
      }
      
      setRewordSuggestion(data.reworded);
    } catch (error) {
      console.error('Error rewording:', error);
      showToast('Failed to reword question. Please try again.', 'error');
    } finally {
      setIsRewording(false);
    }
  }, [content, isRewording, showToast]);
  
  // Accept the reword suggestion
  const acceptReword = useCallback(() => {
    if (rewordSuggestion) {
      setContent(rewordSuggestion);
      setRewordSuggestion(null);
    }
  }, [rewordSuggestion]);
  
  // Decline the reword suggestion
  const declineReword = useCallback(() => {
    setRewordSuggestion(null);
  }, []);
  
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
    
    try {
      // Create question via API route (includes rate limiting)
      const response = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: questionContent,
          isAnonymous,
          expiresAt,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle rate limit error
        if (response.status === 429) {
          showToast(data.error || 'Rate limit reached. Please try again later.', 'error');
        } else {
          showToast(data.error || 'Failed to create question', 'error');
        }
        setIsLoading(false);
        setIsAnimating(false);
        return;
      }

      // Success! Spawn confetti celebration
      spawnCelebrationConfetti();
      triggerHaptic(30); // Longer haptic for success

      // Reset form immediately - don't wait for categorization or notifications
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

      // Check if question matches a prompt and regenerate if needed (fire and forget)
      fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionContent }),
      })
        .then(res => res.json())
        .then(promptData => {
          if (promptData.matched) {
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

      // Refresh questions to show AI vote (API route handles AI voting)
      onQuestionCreated?.();

    } catch (error) {
      console.error('Error creating question:', error);
      showToast('Failed to create question. Please try again.', 'error');
      setIsLoading(false);
      setIsAnimating(false);
    }
  };

  // For logged-out users, show the typewriter animation but redirect to sign-in on click
  if (!user) {
    return (
      <Card className="border-dashed hover:border-solid transition-all duration-200">
        <CardContent className="p-4">
          <button
            onClick={() => signInWithGoogle()}
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
            
            {/* Reword suggestion */}
            {rewordSuggestion && (
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-950/50">
                <div className="flex items-start gap-2">
                  <Wand2 className="h-4 w-4 mt-0.5 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-violet-700 dark:text-violet-300 mb-1">
                      AI Suggestion
                    </p>
                    <p className="text-sm text-zinc-900 dark:text-zinc-100">
                      {rewordSuggestion}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        size="sm"
                        onClick={acceptReword}
                        className="h-7 gap-1 bg-violet-600 hover:bg-violet-700 text-white"
                      >
                        <Check className="h-3 w-3" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={declineReword}
                        className="h-7 gap-1 text-zinc-600 dark:text-zinc-400"
                      >
                        <X className="h-3 w-3" />
                        Decline
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Actions row: character count, cancel, reword, post */}
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
                    setRewordSuggestion(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReword}
                  disabled={!content.trim() || isRewording || isLoading}
                  className="gap-1.5"
                  title="AI will suggest a reworded version"
                >
                  {isRewording ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  Reword
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


