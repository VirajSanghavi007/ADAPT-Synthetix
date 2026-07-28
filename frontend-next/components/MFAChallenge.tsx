"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export default function MFAChallenge({ onVerified }: { onVerified: () => void }) {
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const totp = data?.totp?.[0];
      if (totp) setFactorId(totp.id);
    });
  }, []);

  async function verify() {
    if (!factorId || code.length !== 6) return;
    setStatus("Verifying...");
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (challengeError) {
      setStatus("Error: " + challengeError.message);
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (error) {
      setStatus("Error: " + error.message);
      return;
    }
    onVerified();
  }

  return (
    <main className="mx-auto max-w-sm p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Two-factor code</h1>
      <p className="text-sm text-muted">Enter the 6-digit code from your authenticator app.</p>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="000000"
        aria-label="Six-digit authentication code"
        className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-center text-lg tracking-widest text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button onClick={verify} variant="accent" size="lg" className="w-full px-4">
        Verify
      </Button>
      {status && <p className="text-sm text-muted">{status}</p>}
    </main>
  );
}
