import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface AssistantContext {
  page: 'feed' | 'question' | 'profile' | 'other';
  questionId?: string;
  profileId?: string;
}

// Generate a proactive insight based on user data
export async function POST(request: NextRequest) {
  try {
    const { context } = await request.json() as { context: AssistantContext };

    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Get user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();

    const userName = profile?.username || 'there';

    // Get voting stats
    const { data: votes } = await supabase
      .from('responses')
      .select('vote, created_at')
      .eq('user_id', user.id)
      .eq('is_ai', false)
      .order('created_at', { ascending: false });

    const totalVotes = votes?.length || 0;

    // If new user, give a welcome message
    if (totalVotes === 0) {
      return Response.json({
        insight: `Hey ${userName}! 👋 Welcome to Aligned. Start voting on some questions and I'll learn your patterns and find people who think like you!`,
      });
    }

    // Calculate today's and this week's votes
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    const votesToday = votes?.filter(v => new Date(v.created_at) >= todayStart).length || 0;
    const votesThisWeek = votes?.filter(v => new Date(v.created_at) >= weekStart).length || 0;

    // Calculate streak
    const dayCounts: Record<string, boolean> = {};
    votes?.forEach(v => {
      const date = new Date(v.created_at).toISOString().split('T')[0];
      dayCounts[date] = true;
    });

    const sortedDays = Object.keys(dayCounts).sort().reverse();
    let currentStreak = 0;

    if (sortedDays.length > 0) {
      const today = now.toISOString().split('T')[0];
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      if (sortedDays[0] === today || sortedDays[0] === yesterday) {
        currentStreak = 1;
        for (let i = 1; i < sortedDays.length; i++) {
          const prevDay = new Date(sortedDays[i - 1]);
          const currDay = new Date(sortedDays[i]);
          const diffDays = (prevDay.getTime() - currDay.getTime()) / (24 * 60 * 60 * 1000);
          if (diffDays === 1) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }

    // Get voting distribution
    const yesCount = votes?.filter(v => v.vote === 'YES').length || 0;
    const noCount = votes?.filter(v => v.vote === 'NO').length || 0;
    const yesPercent = totalVotes > 0 ? Math.round((yesCount / totalVotes) * 100) : 0;
    const noPercent = totalVotes > 0 ? Math.round((noCount / totalVotes) * 100) : 0;

    // Generate insight based on interesting data points
    const insights: string[] = [];

    // Streak insights
    if (currentStreak >= 7) {
      insights.push(`🔥 Wow, ${userName}! You're on a ${currentStreak}-day voting streak! That's impressive dedication.`);
    } else if (currentStreak >= 3) {
      insights.push(`🔥 Nice! You're on a ${currentStreak}-day streak. Keep it going!`);
    }

    // Activity insights
    if (votesToday >= 10) {
      insights.push(`⚡ You've cast ${votesToday} votes today! Someone's on a roll.`);
    } else if (votesToday >= 5) {
      insights.push(`👍 Nice activity today - ${votesToday} votes and counting!`);
    }

    if (votesThisWeek >= 50) {
      insights.push(`📊 ${votesThisWeek} votes this week! You're one of the most active users.`);
    }

    // Pattern insights
    if (yesPercent >= 70) {
      insights.push(`☀️ You're quite the optimist - voting Yes ${yesPercent}% of the time!`);
    } else if (noPercent >= 70) {
      insights.push(`🤔 You're a skeptic at heart - voting No ${noPercent}% of the time!`);
    } else if (Math.abs(yesPercent - 50) <= 5) {
      insights.push(`⚖️ Perfectly balanced voting at ${yesPercent}% Yes / ${noPercent}% No. Impressive!`);
    }

    // Milestone insights
    if (totalVotes === 100 || totalVotes === 250 || totalVotes === 500 || totalVotes === 1000) {
      insights.push(`🎉 Milestone alert! You just hit ${totalVotes} total votes!`);
    } else if (totalVotes >= 100 && totalVotes < 150) {
      insights.push(`💯 You've crossed 100 votes! I'm starting to really understand your perspective.`);
    }

    // Context-specific insights
    if (context.page === 'question' && context.questionId) {
      insights.push(`💭 Want me to explain why people voted the way they did on this question?`);
    }

    if (context.page === 'profile' && context.profileId && context.profileId !== 'ai') {
      insights.push(`👀 I can tell you how you compare with this person - want to see where you agree and differ?`);
    }

    // Default insights if nothing special
    if (insights.length === 0) {
      const defaults = [
        `Hey ${userName}! 👋 Ask me about your voting patterns, or who thinks like you!`,
        `Hi ${userName}! With ${totalVotes} votes, I've got some insights about your opinions. Ask away!`,
        `Hey ${userName}! Want to know your most controversial votes, or find users who think like you?`,
      ];
      insights.push(defaults[Math.floor(Math.random() * defaults.length)]);
    }

    // Return a random insight from the collected ones
    const selectedInsight = insights[Math.floor(Math.random() * insights.length)];

    return Response.json({ insight: selectedInsight });

  } catch (error) {
    console.error('Insight error:', error);
    return Response.json({ insight: "Hey! 👋 Ask me anything about your voting patterns or this app!" });
  }
}

