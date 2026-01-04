# Aligned - The Opinion Discovery Platform

A modern web application that functions as a cross between Twitter and Quora, focused on binary polling (Yes/No/Not Sure) to track how opinions change over time and how people align.

## Core Features

### Polling & Voting
- **Binary Polling**: Vote Yes, No, or Not Sure on user-generated questions
- **Optimistic UI**: Instant visual feedback with haptic feedback and confetti animations
- **Real-time Updates**: See votes as they happen via Supabase Realtime
- **Anonymous Voting**: Toggle private mode to vote without appearing in the voter list
- **Vote History**: Track how your opinions evolve over time and see when you changed your mind
- **Voter List**: See who voted and how (respects anonymous votes)

### AI Integration
- **AI Votes**: The AI automatically votes on every question with reasoning
- **AI Profile**: Compare your votes with the AI to see agreement rate, common ground, and divergence
- **AI Assistant**: Context-aware chatbot for insights, recommendations, and brainstorming questions
- **@AI Mentions**: Tag AI in comments to get intelligent responses with streaming output
- **AI-Generated Questions**: The AI periodically posts thought-provoking questions

### Comments & Social
- **Threaded Comments**: Comment on questions with @mentions and autocomplete
- **GIF Picker**: Add GIFs to comments via Tenor integration
- **Follow System**: Follow users and see their activity in your notifications
- **Notifications**: Real-time notifications for mentions, follows, votes, comments, and new questions
- **Notification Preferences**: Customize which notification types you receive

### Question Creation
- **Time-Limited Polls**: Set expiration (1h, 24h, or 1 week) for time-sensitive questions
- **Anonymous Posting**: Post questions without your name attached
- **Topic Inspiration**: AI-powered prompts across 12+ categories to spark ideas
- **AI Brainstorm**: Use the AI assistant to help craft the perfect question
- **Auto-Categorization**: Questions are automatically categorized by AI
- **Edit/Delete**: Modify or remove your questions after posting

### Discovery & Filtering
- **Categories**: 15 categories including Hypothetical, Ethics, Relationships, Technology, Politics, and more
- **Smart Sorting**: Sort by Newest, Most Votes, Most Commented, Most Split (controversial), Most Agreed, Most Undecided, or Most Sensitive (anonymous votes)
- **Feed Filters**: Filter by minimum votes, time period, poll status (active/closed), and unanswered only
- **Search**: Full-text search with keyboard shortcut (⌘K)
- **Infinite Scroll**: Seamless content loading

### Profiles & Comparison
- **Agreement Rate**: See compatibility percentage between any two users
- **Common Ground**: Questions where you and another user agree
- **Divergence**: Questions where you disagree
- **Vote Stats**: Total votes, breakdown by Yes/No/Not Sure, and changed votes count
- **Created Questions**: View all questions a user has posted
- **Follow Counts**: See followers and following lists

### Onboarding
- **Category Picker**: New users choose a starting category
- **Progress Bar**: Vote on 10 questions to unlock AI comparison
- **Confetti Celebration**: Fun animation when reaching the goal

### PWA Support
- **Installable**: Native install prompt on mobile devices
- **App Badges**: Unread notification count on app icon
- **Splash Screens**: Custom launch screens for iOS and Android

### Other
- **Landing Page**: Beautiful dark-themed landing page for logged-out users
- **In-App Browser Detection**: Guides users to open in Safari/Chrome for OAuth
- **Privacy & Terms**: Built-in privacy policy and terms of service pages
- **Dark Mode**: Full dark mode support throughout the app

## Tech Stack

- **Framework**: Next.js 15 (App Router, TypeScript)
- **Styling**: Tailwind CSS 4
- **Backend/Database**: Supabase (PostgreSQL, Auth, Realtime)
- **Auth**: Supabase Auth (Google OAuth)
- **AI**: OpenAI GPT-4 for voting, comments, categorization, and assistant
- **GIFs**: Tenor API for GIF picker
- **Icons**: Lucide React
- **Analytics**: PostHog

## Getting Started

### Prerequisites

1. Node.js 18+
2. A Supabase account ([supabase.com](https://supabase.com))

### Setup

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   - Create a new Supabase project and get your project URL and anon key from Settings → API
   - Get an OpenAI API key from [platform.openai.com](https://platform.openai.com)
   - Create a `.env.local` file in the project root:
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
     OPENAI_API_KEY=your-openai-key-here
     ```

3. **Run the database migrations**:
   - Go to the Supabase SQL Editor
   - Copy the contents of `supabase/schema.sql`
   - Run the SQL to create all tables, functions, and triggers

4. **Configure Google OAuth**:
   - In Supabase Dashboard, go to Authentication → Providers
   - Enable Google and add your OAuth credentials
   - Add `http://localhost:3000/auth/callback` to your Google OAuth redirect URIs

5. **Start the development server**:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## Database Schema

### Tables

- **profiles**: User profile information (linked to Supabase Auth), notification preferences, onboarding state
- **questions**: Binary poll questions (280 char limit) with category, expiration, anonymous flag, and denormalized vote counts
- **responses**: Current user votes on questions (supports anonymous votes and AI votes with reasoning)
- **response_history**: Historical record of vote changes
- **comments**: Comments on questions with @mention support
- **follows**: User follow relationships
- **notifications**: User notifications for various activity types
- **prompts**: Dynamic question inspiration prompts (AI-managed)
- **ai_logs**: Logging for AI API calls and usage

### Key Functions

- `calculate_compatibility(user_a, user_b)`: Returns compatibility score between two users
- `get_common_ground(user_a, user_b)`: Returns questions where users agree on controversial topics
- `get_divergence(user_a, user_b)`: Returns questions where users disagree
- Triggers for denormalizing vote counts and maintaining response history

## Project Structure

```
aligned/
├── app/
│   ├── api/
│   │   ├── ai-assistant/         # AI chatbot endpoints
│   │   ├── ai-comment/           # AI comment responses
│   │   ├── ai-question/          # AI question generation
│   │   ├── ai-vote/              # AI voting with reasoning
│   │   ├── categorize/           # Auto-categorization
│   │   ├── prompts/              # Dynamic prompt management
│   │   └── search/               # Full-text search
│   ├── auth/
│   │   ├── callback/             # OAuth callback handler
│   │   └── auth-code-error/
│   ├── profile/
│   │   ├── [id]/                 # User profiles
│   │   └── ai/                   # AI profile page
│   ├── question/[id]/            # Question detail pages
│   ├── page.tsx                  # Feed page
│   └── globals.css               # Global styles & animations
├── components/
│   ├── ai-assistant/             # AI chatbot panel & FAB
│   ├── onboarding/               # New user onboarding flow
│   ├── ui/                       # Reusable UI components
│   ├── question-card.tsx         # Voting, comments, voter list
│   ├── create-question.tsx       # Question creation with AI help
│   ├── notifications-dropdown.tsx
│   ├── search.tsx
│   └── gif-picker.tsx
├── contexts/
│   └── auth-context.tsx
├── lib/
│   ├── supabase/                 # Supabase client configs
│   ├── types.ts                  # TypeScript types
│   ├── features.ts               # Feature flags
│   └── utils.ts
├── supabase/
│   ├── schema.sql                # Core database schema
│   └── *.sql                     # Additional migrations
└── public/
    ├── manifest.json             # PWA manifest
    └── splash/                   # PWA splash screens
```

## Design Principles

- **Minimalist & Data-Focused**: Clean interface that highlights the data
- **Color Semantics**: Green for Yes, Red for No, Amber for Unsure, Violet for AI
- **Mobile-First**: Responsive design with PWA support
- **Optimistic Updates**: Immediate feedback with animations and haptic feedback
- **Privacy-Conscious**: Anonymous voting and posting options

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=your-openai-key
TENOR_API_KEY=your-tenor-key (optional, for GIF picker)
```

## License

MIT
