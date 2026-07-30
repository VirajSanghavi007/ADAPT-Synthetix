"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { API_URL } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/Logo";

export default function EnterpriseChallenge({ onVerified }: { onVerified: () => void }) {
  const { session } = useSession();
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`${API_URL}/api/enterprise/verify-id`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ employee_id: employeeId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "verification failed");
      if (data.verified) {
        onVerified();
      } else {
        setStatus("That ID doesn't match our records.");
      }
    } catch (err) {
      setStatus("Error: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <form
        onSubmit={verify}
        className="animate-fade-up card-elevated w-full max-w-sm space-y-5 rounded-2xl border border-border p-8 text-center"
      >
        <div className="flex flex-col items-center gap-3">
          <Logo className="h-10 w-10" />
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Enterprise verification</h1>
            <p className="mt-1 text-sm text-muted">Enter your company employee ID to continue.</p>
          </div>
        </div>

        <div className="space-y-1.5 text-left">
          <Label htmlFor="employee-id">Employee ID</Label>
          <Input
            id="employee-id"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            autoFocus
            required
          />
        </div>

        <Button type="submit" disabled={busy} variant="accent" size="lg" className="w-full cursor-pointer">
          Verify
        </Button>

        {status && (
          <p className="text-sm text-destructive" role="status" aria-live="polite">
            {status}
          </p>
        )}
      </form>
    </main>
  );
}
