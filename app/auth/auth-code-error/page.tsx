import Link from 'next/link';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30">
            <AlertCircle className="h-6 w-6 text-rose-600" />
          </div>
          <CardTitle>Authentication Error</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            There was an error during the authentication process. This could happen if:
          </p>
          <ul className="list-inside list-disc text-left text-sm text-zinc-600 dark:text-zinc-400">
            <li>The authentication link expired</li>
            <li>The link was already used</li>
            <li>There was a problem with the OAuth provider</li>
          </ul>
          <Link href="/">
            <Button className="mt-4 gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}


