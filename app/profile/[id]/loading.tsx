import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 slide-in-from-bottom-2">
      {/* Back Button */}
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      {/* Profile Header Skeleton */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-4">
            {/* Avatar skeleton */}
            <div className="h-20 w-20 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
            <div className="flex-1 space-y-2">
              {/* Username skeleton */}
              <div className="h-7 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              {/* Email skeleton */}
              <div className="h-4 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
              {/* Member since skeleton */}
              <div className="h-3 w-28 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Follow counts skeleton */}
          <div className="flex gap-6">
            <div className="space-y-1">
              <div className="h-5 w-8 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-3 w-16 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            </div>
            <div className="space-y-1">
              <div className="h-5 w-8 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-3 w-16 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards Skeleton */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 text-center">
              <div className="mx-auto mb-2 h-8 w-12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="mx-auto h-3 w-16 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Vote Distribution Skeleton */}
      <Card className="mb-6">
        <CardHeader>
          <div className="h-5 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        </CardHeader>
        <CardContent>
          <div className="h-3 w-full animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
        </CardContent>
      </Card>

      {/* Tabs Skeleton */}
      <div className="mb-4 flex gap-2">
        {['Stances', 'Questions', 'History'].map((tab) => (
          <div
            key={tab}
            className="h-9 w-24 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700"
          />
        ))}
      </div>

      {/* Content Skeleton */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

