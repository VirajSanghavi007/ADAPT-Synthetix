"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="animate-fade-up flex flex-col items-center gap-4">
        <Logo className="h-12 w-12" />
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-2 max-w-sm text-muted">
            An unexpected error occurred. You can try again, or head back to the dashboard.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="accent" size="lg" onClick={reset} className="cursor-pointer px-6">
            Try again
          </Button>
        </div>
      </div>
    </main>
  );
}
