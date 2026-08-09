"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/useSession";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  const { session, loading } = useSession();
  const router = useRouter();

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
        <Link
          href="/login"
          className={buttonVariants({ variant: "accent", size: "lg", className: "glow-accent px-6" })}
        >
          Sign in
        </Link>
        <Link href="/privacy" className="text-sm text-muted underline underline-offset-2 hover:text-foreground">
          Privacy Policy
        </Link>
      </div>
    </main>
  );
}
