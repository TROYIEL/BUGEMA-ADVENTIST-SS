"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="container-page flex flex-1 items-center py-24">
      <div className="flex max-w-xl flex-col gap-5">
        <h1 className="text-display-sm md:text-display-md">Something went wrong</h1>
        <p className="text-lg leading-relaxed text-ink-600">
          Sorry — this page could not be loaded. Please try again.
        </p>
        {/* The digest is the only safe identifier to surface: the message may
            contain internal detail. */}
        {error.digest ? (
          <p className="text-sm text-ink-500">Reference: {error.digest}</p>
        ) : null}
        <div className="mt-2">
          <Button onClick={reset} withArrow>
            Try again
          </Button>
        </div>
      </div>
    </main>
  );
}
