"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/useSession";
import { useAAL } from "@/lib/useAAL";
import { supabase } from "@/lib/supabase";
import Recorder from "@/components/Recorder";
import TTSPanel from "@/components/TTSPanel";
import ThemeToggle from "@/components/ThemeToggle";
import MFAChallenge from "@/components/MFAChallenge";
import Logo from "@/components/Logo";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  const { session, loading } = useSession();
  const { loading: aalLoading, needsChallenge } = useAAL();
  const [verified, setVerified] = useState(false);

  if (loading || aalLoading) return null;

  if (!session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="animate-fade-up flex flex-col items-center gap-4">
          <Logo className="h-14 w-14" />
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">Mercury</h1>
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
        </div>
      </main>
    );
  }

  if (needsChallenge && !verified) {
    return <MFAChallenge onVerified={() => setVerified(true)} />;
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <ThemeToggle />
      <div className="animate-fade-up flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Mercury</h1>
            <p className="text-sm text-muted">{session.user.email}</p>
          </div>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="cursor-pointer text-sm text-muted underline hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Sign out
        </button>
      </div>
      <Recorder />
      <TTSPanel />
    </main>
  );
}
