# Consensus - The Opinion Discovery Platform

A modern web application that functions as a cross between Twitter and Quora, focused on binary polling (Yes/No/Not Sure) to track how opinions change over time and how people align.

## Features

- **Binary Polling**: Vote Yes, No, or Unsure on user-generated questions
- **Optimistic UI**: Instant visual feedback when voting
- **Real-time Updates**: See votes as they happen via Supabase Realtime
- **Opinion Tracking**: Track how your opinions evolve over time
- **Compatibility Scores**: Compare your views with other users
- **Common Ground & Divergence**: Find what you agree and disagree on
- **Smart Sorting**: Filter by Most Controversial, Most Agreed, or Newest

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Styling**: Tailwind CSS 4
- **Backend/Database**: Supabase (PostgreSQL, Auth, Realtime)
- **Auth**: Supabase Auth (Google OAuth)
- **Icons**: Lucide React

## Getting Started

### Prerequisites

1. Node.js 18+
2. A Supabase account ([supabase.com](https://supabase.com))

### Setup

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Set up Supabase**:
   - Create a new Supabase project
   - Go to Settings → API to get your project URL and anon key
   - Create a `.env.local` file in the project root:
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
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

- **profiles**: User profile information (linked to Supabase Auth)
- **questions**: Binary poll questions (280 char limit)
- **responses**: Current user votes on questions
- **response_history**: Historical record of vote changes

### Key Functions

- `calculate_compatibility(user_a, user_b)`: Returns compatibility score between two users
- `get_common_ground(user_a, user_b)`: Returns questions where users agree on controversial topics
- `get_divergence(user_a, user_b)`: Returns questions where users disagree

### Views

- `question_stats`: Aggregated vote counts and percentages for each question

## Project Structure

```
consensus-app/
├── app/
│   ├── auth/
│   │   ├── callback/route.ts     # OAuth callback handler
│   │   └── auth-code-error/page.tsx
│   ├── profile/[id]/
│   │   ├── page.tsx              # Profile server component
│   │   └── profile-client.tsx    # Profile client component
│   ├── globals.css
│   ├── layout.tsx
│   ├── not-found.tsx
│   └── page.tsx                  # Feed page
├── components/
│   ├── ui/
│   │   ├── avatar.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── progress-bar.tsx
│   ├── create-question.tsx
│   ├── feed-filters.tsx
│   ├── header.tsx
│   └── question-card.tsx
├── contexts/
│   └── auth-context.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser Supabase client
│   │   ├── middleware.ts         # Session refresh middleware
│   │   └── server.ts             # Server Supabase client
│   ├── types.ts                  # TypeScript types
│   └── utils.ts                  # Utility functions
├── supabase/
│   └── schema.sql                # Database schema
└── middleware.ts                 # Next.js middleware
```

## Design Principles

- **Minimalist & Data-Focused**: Clean interface that highlights the data
- **Color Semantics**: Green for Yes, Red for No, Amber for Unsure
- **Mobile-First**: Responsive design that works on all devices
- **Optimistic Updates**: Immediate feedback for better UX

## License

MIT
