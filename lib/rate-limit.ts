import { createClient } from '@/lib/supabase/server';

export type RateLimitType = 'question' | 'comment' | 'ai_query';

interface RateLimitConfig {
  dailyLimit: number;
  hourlyLimit?: number;
}

const RATE_LIMITS: Record<RateLimitType, RateLimitConfig> = {
  question: {
    dailyLimit: 20,
    hourlyLimit: 5,
  },
  comment: {
    dailyLimit: 100,
    hourlyLimit: 20,
  },
  ai_query: {
    dailyLimit: 50, // This is already used by AI endpoints
  },
};

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  error?: string;
}

/**
 * Check if a user has exceeded their rate limit for a given action type
 */
export async function checkRateLimit(
  userId: string,
  type: RateLimitType
): Promise<RateLimitResult> {
  const supabase = await createClient();
  const config = RATE_LIMITS[type];
  
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  // Check daily limit
  const { count: dailyCount } = await supabase
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action_type', type)
    .gte('created_at', today.toISOString());
  
  const dailyRemaining = Math.max(0, config.dailyLimit - (dailyCount || 0));
  
  if ((dailyCount || 0) >= config.dailyLimit) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      allowed: false,
      remaining: 0,
      resetAt: tomorrow,
      error: `Daily limit reached (${config.dailyLimit} ${type}s per day). Try again tomorrow!`,
    };
  }
  
  // Check hourly limit if configured
  if (config.hourlyLimit) {
    const { count: hourlyCount } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action_type', type)
      .gte('created_at', oneHourAgo.toISOString());
    
    const hourlyRemaining = Math.max(0, config.hourlyLimit - (hourlyCount || 0));
    
    if ((hourlyCount || 0) >= config.hourlyLimit) {
      const nextHour = new Date(now);
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      return {
        allowed: false,
        remaining: Math.min(dailyRemaining, hourlyRemaining),
        resetAt: nextHour,
        error: `Hourly limit reached (${config.hourlyLimit} ${type}s per hour). Try again in a bit!`,
      };
    }
  }
  
  // Calculate reset time (next day at midnight)
  const resetAt = new Date(today);
  resetAt.setDate(resetAt.getDate() + 1);
  
  return {
    allowed: true,
    remaining: dailyRemaining - 1, // Subtract 1 for the current request
    resetAt,
  };
}

/**
 * Record a rate limit usage (call this after the action succeeds)
 */
export async function recordRateLimit(
  userId: string,
  type: RateLimitType,
  metadata?: Record<string, any>
): Promise<void> {
  const supabase = await createClient();
  
  await supabase.from('rate_limits').insert({
    user_id: userId,
    action_type: type,
    metadata: metadata || {},
  });
}

