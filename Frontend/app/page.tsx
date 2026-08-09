"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/useSession";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";
import { Button, buttonVariants } from "@/components/ui/button";

const DEMO_DOMAINS = [
  { value: "medical", label: "Medical" },
  { value: "children", label: "Children" },
  { value: "elderly", label: "Elderly" },
];

export default function Home() {
  const { session, loading } = useSession();
  const router = useRouter();
  const [showDemoPicker, setShowDemoPicker] = useState(false);

  useEffect(() => {
    if (!loading && session) router.replace("/dashboard");
  }, [loading, session, router]);

  if (loading || session) return null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <ThemeToggle />
      <div className="animate-fade-up flex flex-col items-center gap-4">
        <Logo className="h-14 w-14" />
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">ADAPT-Synthetix</h1>
          <p className="mt-2 max-w-sm text-muted">
            Speech-to-text and text-to-speech for lecture and medical transcription.
          </p>
        </div>

        {!showDemoPicker && (
          <div className="flex w-full max-w-xs flex-col gap-3">
            <Link href="/login" className={buttonVariants({ variant: "accent", size: "lg", className: "glow-accent w-full" })}>
              Sign in
            </Link>
            <Link href="/enterprise-signup" className={buttonVariants({ variant: "secondary", size: "lg", className: "w-full" })}>
              Enterprise sign in
            </Link>
            <Button variant="outline" size="lg" className="w-full" onClick={() => setShowDemoPicker(true)}>
              Try an enterprise demo
            </Button>
          </div>
        )}

        {showDemoPicker && (
          <div className="flex w-full max-w-xs flex-col gap-3">
            <p className="text-sm text-muted">Pick a service to preview</p>
            {DEMO_DOMAINS.map((d) => (
              <Link
                key={d.value}
                href={`/demo/${d.value}`}
                className={buttonVariants({ variant: "secondary", size: "lg", className: "w-full" })}
              >
                {d.label}
              </Link>
            ))}
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowDemoPicker(false)}>
              Back
            </Button>
          </div>
        )}

        <Link href="/privacy" className="text-sm text-muted underline underline-offset-2 hover:text-foreground">
          Privacy Policy
        </Link>
      </div>
    </main>
  );
}
