"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary. Any server-component or data-layer throw inside a
 * page renders this instead of a naked 500, and the rep can retry without a
 * full reload. Keeps the app shell (nav) mounted around it.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface it for debugging without leaking the stack to the rep.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-xl">⚠️</div>
      <h1 className="text-lg font-semibold">Something went sideways</h1>
      <p className="text-sm text-muted-foreground">
        That screen hit a snag loading. It&apos;s not you. Try again, and if it keeps happening let us know.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/today")}>
          Back to Today
        </Button>
      </div>
    </div>
  );
}
