"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Phone, ShieldCheck, KeyRound, LogIn } from "lucide-react";
import { useSession } from "@/lib/useSession";
import { useProfile } from "@/lib/useProfile";
import { supabase } from "@/lib/supabase";
import { DEFAULT_COUNTRY, type Country } from "@/lib/countries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MFAEnroll from "@/components/MFAEnroll";
import PhoneInput from "@/components/PhoneInput";
import DeleteAccountCard from "@/components/DeleteAccountCard";
import UsageStatsCard from "@/components/UsageStatsCard";

export default function AccountPage() {
  const { session } = useSession();
  const { profile } = useProfile();
  const email = session?.user.email ?? "";
  const [newEmail, setNewEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const googleIdentity = session?.user.identities?.find((i) => i.provider === "google");

  async function updateEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setBusy(true);
    setStatus(null);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setStatus(error ? `Error: ${error.message}` : "Confirmation link sent to your new email.");
    setBusy(false);
  }

  async function updatePhone(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setBusy(true);
    setStatus(null);
    const e164 = `${phoneCountry.dial}${phone.replace(/[\s-]/g, "")}`;
    const { error } = await supabase.auth.updateUser({ phone: e164 });
    setStatus(error ? `Error: ${error.message}` : "Phone number updated — check it for an SMS verification code.");
    setBusy(false);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    setBusy(true);
    setStatus(null);
    // Supabase's updateUser doesn't take the current password — re-authenticate first
    // so a stolen/left-open session can't silently change it.
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (reauthError) {
      setStatus("Current password is incorrect.");
      setBusy(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setStatus(error ? `Error: ${error.message}` : "Password changed.");
    setCurrentPassword("");
    setNewPassword("");
    setBusy(false);
  }

  async function unlinkGoogle() {
    if (!googleIdentity) return;
    setBusy(true);
    setStatus(null);
    const { error } = await supabase.auth.unlinkIdentity(googleIdentity);
    setStatus(error ? `Error: ${error.message}` : "Google account unlinked. Link a different one below.");
    setBusy(false);
  }

  async function linkGoogle() {
    await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo: window.location.href } });
  }

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-muted">Contact details and security — edit your username/avatar under Profile.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> Change email
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={updateEmail} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-email">New email address</Label>
                <Input
                  id="new-email"
                  type="email"
                  autoComplete="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder={email}
                />
              </div>
              <Button type="submit" disabled={busy} className="cursor-pointer">
                Send confirmation
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-4 w-4" /> Phone number
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={updatePhone} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone number</Label>
                <PhoneInput
                  id="phone"
                  value={phone}
                  onValueChange={setPhone}
                  country={phoneCountry}
                  onCountryChange={setPhoneCountry}
                />
              </div>
              <Button type="submit" disabled={busy} className="cursor-pointer">
                Update phone
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {status && (
        <p className="text-sm text-muted" role="status" aria-live="polite">
          {status}
        </p>
      )}

      <UsageStatsCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Two-factor authentication
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MFAEnroll />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogIn className="h-4 w-4" /> Google account
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          {googleIdentity ? (
            <>
              <p className="text-sm text-muted">
                Linked: <span className="text-foreground">{googleIdentity.identity_data?.email as string}</span>
              </p>
              <Button variant="outline" disabled={busy} onClick={unlinkGoogle} className="cursor-pointer">
                Unlink
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">No Google account linked.</p>
              <Button variant="outline" onClick={linkGoogle} className="cursor-pointer">
                Link Google account
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Change password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy} className="sm:col-span-2 cursor-pointer">
              Change password
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Password reset link
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted">Reset your password via email link.</p>
          <Link href="/reset-password" className={buttonVariants({ variant: "outline", className: "cursor-pointer" })}>
            Reset password
          </Link>
        </CardContent>
      </Card>

      <DeleteAccountCard tier={profile?.tier} />
    </div>
  );
}
