"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { useAAL } from "@/lib/useAAL";
import { Button } from "@/components/ui/button";
import MFAChallenge from "@/components/MFAChallenge";

export default function ResetPasswordPage() {
  const { session, loading } = useSession();
  const { loading: aalLoading, needsChallenge } = useAAL();
  const [verified, setVerified] = useState(false);
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("");

  async function updatePassword() {
    if (password.length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setStatus("Passwords don't match.");
      return;
    }
    setStatus("Updating...");
    const res = await fetch(`${API_URL}/api/auth/update-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      setStatus("Error: " + (await res.text()));
      return;
    }
    setStatus("Password updated. Redirecting...");
    setTimeout(() => router.push("/"), 1500);
  }

  if (loading || aalLoading) return null;

  if (!session) {
    return (
      <main className="mx-auto max-w-md space-y-4 p-8 text-center">
        <p>This link is invalid or expired.</p>
        <a href="/login" className="text-accent underline hover:opacity-90">
          Back to sign in
        </a>
      </main>
    );
  }

  if (needsChallenge && !verified) {
    return <MFAChallenge onVerified={() => setVerified(true)} />;
  }

  return (
    <main className="mx-auto max-w-md space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Set a new password</h1>
      <label htmlFor="new-password" className="sr-only">
        New password
      </label>
      <input
        id="new-password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password"
        autoComplete="new-password"
        className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <label htmlFor="confirm-password" className="sr-only">
        Confirm new password
      </label>
      <input
        id="confirm-password"
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Confirm new password"
        autoComplete="new-password"
        className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button onClick={updatePassword} variant="accent" size="lg" className="w-full px-4">
        Update password
      </Button>
      {status && <p className="text-sm text-muted" role="status" aria-live="polite">{status}</p>}
    </main>
  );
}
