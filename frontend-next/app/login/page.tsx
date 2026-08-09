"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import MFAEnroll from "@/components/MFAEnroll";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import { usePageTitle } from "@/lib/usePageTitle";

// "choice" is the real landing state — Google or email, nothing assumed. Passkey is
// only offered once someone has picked email, and only as "I already have one" — a
// first-time visitor was previously dropped straight into a passkey prompt with no
// account and no passkey to use, which just failed confusingly. Passkey *creation*
// still only happens post-signin (see registerPasskey below) since WebAuthn needs an
// existing account to attach a credential to — there's no way to create one before that.
type Mode = "choice" | "password" | "passkey" | "forgot";

export default function LoginPage() {
  usePageTitle("Sign in");
  const { session } = useSession();
  const [mode, setMode] = useState<Mode>("choice");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [status, setStatus] = useState("");

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }

  async function signInWithPasskey() {
    setStatus("Follow your browser's passkey prompt...");
    const { error } = await supabase.auth.signInWithPasskey();
    if (error) {
      setMode("password");
      setStatus(
        "Couldn't sign in with a passkey (none registered on this device, or the prompt was cancelled) — use your password instead, then add a passkey from your account for next time."
      );
      return;
    }
    setStatus("Signed in.");
  }

  async function submitPassword() {
    if (!email || !password) return;
    setStatus(isSignUp ? "Creating account..." : "Signing in...");
    const { data, error } = isSignUp
      ? await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        })
      : await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus("Error: " + error.message);
      return;
    }
    if (isSignUp && !data.session) {
      setStatus("Check your email to confirm your account before signing in.");
      return;
    }
    setStatus(isSignUp ? "Account created." : "Signed in.");
  }

  async function sendPasswordReset() {
    if (!email) {
      setStatus("Enter your email first.");
      return;
    }
    setStatus("Sending reset link...");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password/`,
    });
    if (error) {
      setStatus("Error: " + error.message);
      return;
    }
    setStatus("Check your email for a password reset link.");
  }

  async function registerPasskey() {
    if (!session) {
      setStatus("Sign in first, then add a passkey.");
      return;
    }
    setStatus("Follow your browser's passkey prompt...");
    const { error } = await supabase.auth.registerPasskey();
    if (error) {
      setStatus("Passkey registration failed: " + error.message);
      return;
    }
    setStatus("Passkey registered — you can use it to sign in next time.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="animate-fade-up card-elevated w-full max-w-md space-y-6 rounded-2xl border border-border p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo className="h-10 w-10" />
          <div>
            <h1 className="text-2xl font-semibold">Sign in to ADAPT-Synthetix</h1>
            <p className="mt-1 text-sm text-muted">Speech-to-text and text-to-speech, built for research</p>
          </div>
        </div>

        {mode === "choice" && (
          <div className="space-y-3">
            <Button onClick={signInWithGoogle} variant="outline" size="lg" className="w-full px-4">
              <svg viewBox="0 0 24 24" className="h-4 w-4">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.12-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
              </svg>
              Continue with Google
            </Button>
            <Button onClick={() => setMode("password")} variant="secondary" size="lg" className="w-full px-4">
              Continue with email
            </Button>
          </div>
        )}

        {mode === "password" && (
          <div className="space-y-2">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button onClick={submitPassword} variant="accent" size="lg" className="w-full px-4">
              {isSignUp ? "Create account" : "Sign in"}
            </Button>
            <div className="flex justify-between text-sm">
              <button
                onClick={() => setIsSignUp((v) => !v)}
                className="cursor-pointer text-muted underline hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {isSignUp ? "Already have an account? Sign in" : "New here? Create an account"}
              </button>
              {!isSignUp && (
                <button
                  onClick={() => setMode("forgot")}
                  className="cursor-pointer text-muted underline hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Forgot password?
                </button>
              )}
            </div>
            {!isSignUp && (
              <button
                onClick={() => setMode("passkey")}
                className="w-full cursor-pointer text-sm text-muted underline hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                I already have a passkey
              </button>
            )}
            <button
              onClick={() => setMode("choice")}
              className="w-full cursor-pointer text-sm text-muted underline hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Back
            </button>
          </div>
        )}

        {mode === "passkey" && (
          <div className="space-y-2">
            <Button onClick={signInWithPasskey} variant="secondary" size="lg" className="w-full px-4">
              Sign in with passkey
            </Button>
            <button
              onClick={() => setMode("password")}
              className="w-full cursor-pointer text-sm text-muted underline hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Use email and password instead
            </button>
          </div>
        )}

        {mode === "forgot" && (
          <div className="space-y-2">
            <Button onClick={sendPasswordReset} variant="accent" size="lg" className="w-full px-4">
              Send password reset link
            </Button>
            <button
              onClick={() => setMode("password")}
              className="w-full cursor-pointer text-sm text-muted underline hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Back to sign in
            </button>
          </div>
        )}

        {session && (
          <>
            <Button onClick={registerPasskey} variant="outline" size="lg" className="w-full px-4">
              Add a passkey to this account
            </Button>
            <MFAEnroll />
          </>
        )}

        {status && <p className="text-sm text-muted" role="status" aria-live="polite">{status}</p>}

        <p className="text-center text-sm text-muted">
          Signing up for a hospital or organization?{" "}
          <Link href="/enterprise-signup" className="underline underline-offset-2 hover:text-foreground">
            Create an enterprise account
          </Link>
        </p>
      </div>
    </main>
  );
}
