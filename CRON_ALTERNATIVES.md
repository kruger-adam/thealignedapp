# Cron Jobs

## Current Setup

All cron jobs run on **[cron-job.org](https://cron-job.org)**. Active jobs:

| Job (cron-job.org name) | Endpoint | Status |
|-------------------------|----------|--------|
| EA Forum daily question | `/api/ai-question/ea-forum` | Active |
| LessWrong daily question | `/api/ai-question/lesswrong` | Active |
| Lenny's Podcast daily question | `/api/ai-question/lennys-podcast` | Active |
| Future of Life Institute Podcast | `/api/ai-question/future-of-life` | Active |
| Open to Debate | `/api/ai-question/open-to-debate` | Active |
| Post AI question | `/api/ai-question` | Disabled |
| Generate questions | `/api/ai-question/generate` | Disabled |

Each job sends an `Authorization: Bearer <CRON_SECRET>` header. The `CRON_SECRET` value can be found in the Vercel environment variables.

---

# Alternatives to Vercel Cron (Exact-Time Scheduling)

Vercel cron jobs have a **1-hour execution window**, meaning they can run anywhere within a 1-hour period around the scheduled time. If you need **exact-time scheduling**, here are free alternatives:

## Option 1: GitHub Actions (Recommended) ⭐

**Pros:**
- ✅ Free for public repositories
- ✅ Free 2,000 minutes/month for private repos
- ✅ Runs at exact scheduled times (no window)
- ✅ Easy to set up and monitor
- ✅ Can manually trigger from GitHub UI

**Setup:**
1. Create `.github/workflows/daily-ai-question.yml` (already created)
2. Add secrets to your GitHub repository:
   - Go to Settings → Secrets and variables → Actions
   - Add `APP_URL`: Your Vercel app URL (e.g., `https://your-app.vercel.app`)
   - Add `CRON_SECRET`: Your `CRON_SECRET` environment variable value
3. The workflow will run daily at 12:00 PM UTC (adjust the cron expression if needed)

**To change the time:**
Edit `.github/workflows/daily-ai-question.yml` and modify the cron expression:
```yaml
- cron: '0 12 * * *'  # 12:00 PM UTC
- cron: '0 17 * * *'  # 5:00 PM UTC
- cron: '30 9 * * *'  # 9:30 AM UTC
```

**Cron format:** `minute hour day month day-of-week`
- All times are in UTC
- Use [crontab.guru](https://crontab.guru) to build expressions

## Option 2: Supabase pg_cron

**Pros:**
- ✅ Runs directly from your database
- ✅ Exact-time scheduling
- ✅ No external dependencies

**Cons:**
- ❌ May not be available on all Supabase plans (check your plan)
- ❌ Requires `http` extension for HTTP requests
- ❌ More complex setup

**Setup:**
1. Check if pg_cron is available:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```
2. If available, run `supabase/pg-cron-setup.sql` in your Supabase SQL Editor
3. Update the hardcoded values in the function with your actual app URL and cron secret

## Option 3: External Cron Services

**Free options:**
- **cron-job.org** - Free tier: 1 job, runs every 5 minutes minimum
- **EasyCron** - Free tier: 1 job, runs every 1 hour minimum
- **Cronitor** - Free tier: 5 monitors

**Setup:**
1. Sign up for a free account
2. Create a new cron job
3. Set the schedule (exact time)
4. Set the URL to one of:
   - `https://your-app.vercel.app/api/ai-question/ea-forum` (EA Forum daily question)
   - `https://your-app.vercel.app/api/ai-question/lesswrong` (LessWrong daily question)
5. Add header: `Authorization: Bearer YOUR_CRON_SECRET`

## Option 4: Cloudflare Workers (Advanced)

**Pros:**
- ✅ Free tier available (100,000 requests/day)
- ✅ Exact-time scheduling with Cron Triggers
- ✅ Very fast execution

**Cons:**
- ❌ Requires setting up a Cloudflare Worker
- ❌ More complex than other options

## Recommendation

**Use GitHub Actions** if your repo is public or you have free minutes. It's the simplest and most reliable free option for exact-time scheduling.

## Removing Vercel Cron

Once you've set up an alternative, you can remove the cron from `vercel.json`:

```json
{
  "functions": {
    // ... keep your function configs
  }
  // Remove the "crons" section
}
```

Your `/api/ai-question` endpoint will still work - it just won't be automatically triggered by Vercel anymore.


