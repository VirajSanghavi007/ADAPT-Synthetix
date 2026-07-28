"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export default function MFAEnroll() {
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [enrolled, setEnrolled] = useState(false);

  async function startEnroll() {
    setStatus("Generating QR code...");
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error) {
      setStatus("Error: " + error.message);
      return;
    }
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setFactorId(data.id);
    setStatus("Scan the QR code, then enter the 6-digit code.");
  }

  async function confirmEnroll() {
    if (code.length !== 6) return;
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
    setEnrolled(true);
    setStatus("Two-factor authentication enabled.");
  }

  if (enrolled) {
    return (
      <p className="flex items-center gap-2 text-sm text-accent">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0">
          <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Two-factor authentication is on.
      </p>
    );
  }

  if (!qrCode) {
    return (
      <Button onClick={startEnroll} variant="outline" size="lg" className="w-full px-4">
        Set up two-factor authentication
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrCode} alt="TOTP QR code" className="mx-auto w-40 rounded bg-white p-2" />
      <p className="break-all text-center text-xs text-muted">{secret}</p>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="000000"
        aria-label="Six-digit authentication code"
        className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-center tracking-widest text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button onClick={confirmEnroll} variant="accent" size="lg" className="w-full px-4">
        Confirm
      </Button>
      {status && <p className="text-sm text-muted">{status}</p>}
    </div>
  );
}
