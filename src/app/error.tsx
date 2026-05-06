"use client";

import { useEffect } from "react";
import { Button } from "@/components/shared/button";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-dvh flex items-center justify-center bg-bg p-6">
      <div className="card-soft w-full max-w-md p-8">
        <h1 className="font-display text-3xl tracking-tight text-ink">
          Something went sideways
        </h1>
        <p className="mt-2 text-muted">
          We hit a snag loading this page. Try again — and if it keeps
          happening, check the logs.
        </p>
        <div className="mt-6 flex justify-end">
          <Button onClick={() => reset()}>Try again</Button>
        </div>
      </div>
    </main>
  );
}
