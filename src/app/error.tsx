"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Route-level error boundary: the canvas/export code is the riskiest surface
 * in an app holding local work, so a crash must never strand the user on the
 * framework's default error screen.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground max-w-md text-center text-sm">
        Your projects are stored locally and are safe. You can try again or go
        back to your projects.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => unstable_retry()}>Try again</Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Back to projects
        </Link>
      </div>
    </div>
  );
}
