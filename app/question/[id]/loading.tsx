import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, HelpCircle, X } from 'lucide-react';
import Link from 'next/link';

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 page-transition-in">
      {/* Back Button */}
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Avatar skeleton */}
              <div className="h-10 w-10 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
              <div className="flex flex-col gap-1">
                {/* Username skeleton */}
                <div className="h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                {/* Time skeleton */}
                <div className="h-3 w-16 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-4">
          {/* Question text skeleton */}
          <div className="space-y-2">
            <div className="h-6 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-6 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
        </CardContent>

        <CardFooter className="flex-col gap-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          {/* Vote buttons skeleton */}
          <div className="grid w-full grid-cols-3 gap-2">
            <Button variant="yes-outline" size="sm" disabled className="flex-1 gap-1.5 opacity-50">
              <Check className="h-4 w-4" />
              Yes
            </Button>
            <Button variant="no-outline" size="sm" disabled className="flex-1 gap-1.5 opacity-50">
              <X className="h-4 w-4" />
              No
            </Button>
            <Button variant="unsure-outline" size="sm" disabled className="flex-1 gap-1.5 opacity-50">
              <HelpCircle className="h-4 w-4" />
              Not Sure / Depends
            </Button>
          </div>

          {/* Progress bar skeleton */}
          <div className="h-2 w-full animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
        </CardFooter>
      </Card>

      {/* Comments section skeleton */}
      <Card className="mt-4">
        <CardHeader>
          <div className="h-5 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                  <div className="h-4 w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

