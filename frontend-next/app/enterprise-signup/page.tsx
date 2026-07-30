"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { supabase, API_URL } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/Logo";

export default function EnterpriseSignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      if (!data.session) {
        setStatus("Check your email to confirm your account, then sign in to finish enterprise setup.");
        setBusy(false);
        return;
      }

      const res = await fetch(`${API_URL}/api/enterprise/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ company_name: companyName, role, employee_id: employeeId }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "enterprise registration failed");

      router.replace("/onboarding");
    } catch (err) {
      setStatus("Error: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <form
        onSubmit={submit}
        className="animate-fade-up card-elevated w-full max-w-md space-y-5 rounded-2xl border border-border p-8"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo className="h-10 w-10" />
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Enterprise account</h1>
            <p className="mt-1 text-sm text-muted">
              Free at Max-tier model access for hospitals and organizations. Your employee ID
              replaces the authenticator app at login.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company">Company / organization name</Label>
          <Input id="company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role">Your role</Label>
          <Input id="role" placeholder="e.g. Radiologist, IT Administrator" value={role} onChange={(e) => setRole(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="employee-id">Employee ID</Label>
          <Input id="employee-id" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required />
          <p className="text-xs text-muted">You'll enter this again each time you sign in.</p>
        </div>

        <Button type="submit" disabled={busy} variant="accent" size="lg" className="w-full cursor-pointer">
          Create enterprise account
        </Button>

        {status && (
          <p className="text-sm text-muted" role="status" aria-live="polite">
            {status}
          </p>
        )}
      </form>
    </main>
  );
}
