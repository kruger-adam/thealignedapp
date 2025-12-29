// Database types for Consensus app

export type VoteType = 'YES' | 'NO' | 'UNSURE' | 'SKIP';

export interface Profile {
  id: string;
  email: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type Category = 
  | 'Politics & Society'
  | 'Relationships & Dating'
  | 'Health & Wellness'
  | 'Technology'
  | 'Entertainment & Pop Culture'
  | 'Food & Lifestyle'
  | 'Sports'
  | 'Work & Career'
  | 'Philosophy & Ethics'
  | 'Other';

export interface Question {
  id: string;
  author_id: string;
  content: string;
  category?: Category;
  created_at: string;
  updated_at: string;
  author?: Partial<Profile>;
}

export interface Response {
  id: string;
  user_id: string;
  question_id: string;
  vote: VoteType;
  created_at: string;
  updated_at: string;
}

export interface ResponseHistory {
  id: string;
  user_id: string;
  question_id: string;
  previous_vote: VoteType | null;
  new_vote: VoteType;
  changed_at: string;
}

export interface QuestionStats {
  question_id: string;
  content: string;
  author_id: string;
  created_at: string;
  total_votes: number;
  yes_count: number;
  no_count: number;
  unsure_count: number;
  anonymous_count: number;
  comment_count: number;
  yes_percentage: number;
  no_percentage: number;
  unsure_percentage: number;
  controversy_score: number;
}

export interface QuestionWithStats extends Question {
  stats: {
    total_votes: number;
    yes_count: number;
    no_count: number;
    unsure_count: number;
    anonymous_count: number;
    comment_count: number;
    yes_percentage: number;
    no_percentage: number;
    unsure_percentage: number;
    controversy_score: number;
  };
  user_vote?: VoteType | null;
  user_vote_is_anonymous?: boolean;
}

export interface Compatibility {
  compatibility_score: number;
  common_questions: number;
  agreements: number;
  disagreements: number;
}

export interface CommonGround {
  question_id: string;
  content: string;
  shared_vote: VoteType;
  controversy_score: number;
}

export interface Divergence {
  question_id: string;
  content: string;
  vote_a: VoteType;
  vote_b: VoteType;
  controversy_score: number;
}

export type SortOption = 'newest' | 'popular' | 'controversial' | 'consensus' | 'most_undecided' | 'most_sensitive' | 'most_commented';

export type NotificationType = 'mention' | 'follow' | 'new_question' | 'vote' | 'comment';

// Comment types
export interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  username: string | null;
  avatar_url: string | null;
  is_ai?: boolean;
  isThinking?: boolean;
  isError?: boolean;
}

// Mention suggestion for @mention autocomplete
export interface MentionSuggestion {
  id: string;
  username: string;
  avatar_url: string | null;
  is_ai?: boolean;
}

// AI mention constant
export const AI_MENTION: MentionSuggestion = {
  id: 'ai',
  username: 'AI',
  avatar_url: null,
  is_ai: true,
};

// Voter display type
export interface Voter {
  id: string;
  username: string | null;
  avatar_url: string | null;
  vote: VoteType;
  is_ai?: boolean;
  ai_reasoning?: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  actor_id: string;
  question_id: string | null;
  comment_id: string | null;
  related_user_id: string | null;
  read: boolean;
  created_at: string;
  // Joined fields for display
  actor?: {
    username: string | null;
    avatar_url: string | null;
  };
  question?: {
    content: string;
    author_id?: string;
  };
  related_user?: {
    username: string | null;
    avatar_url: string | null;
  };
}

