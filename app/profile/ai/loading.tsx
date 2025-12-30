import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Bot } from 'lucide-react';

export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 slide-in-from-bottom-2">
      {/* AI Profile Header Skeleton */}
      <Card className="mb-6 overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600" />
        <CardContent className="relative pb-6 pt-0">
          <div className="-mt-12 mb-3">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg dark:border-zinc-900">
              <Bot className="h-10 w-10 text-white" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-6 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-4 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
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

      {/* Voting History Skeleton */}
      <Card>
        <CardHeader>
          <div className="h-5 w-28 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
              <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}

