"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { AVATARS } from "@/lib/avatars";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import Logo from "@/components/Logo";

export default function OnboardingPage() {
  const { session, loading } = useSession();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [avatarId, setAvatarId] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!avatarId) {
      setStatus("Pick an avatar first.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`${API_URL}/api/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ username: username.trim().toLowerCase(), avatar_id: avatarId }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.replace("/dashboard");
    } catch (err) {
      setStatus("Error: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !session) return null;

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <form
        onSubmit={submit}
        className="animate-fade-up card-elevated w-full max-w-lg space-y-6 rounded-2xl border border-border p-8"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo className="h-10 w-10" />
          <div>
            <h1 className="text-2xl font-semibold">Set up your profile</h1>
            <p className="mt-1 text-sm text-muted">Choose a username and an avatar.</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. dr_sharma"
            autoComplete="off"
            pattern="[a-z0-9_]{3,20}"
            required
          />
          <p className="text-xs text-muted">3-20 characters: lowercase letters, numbers, underscores.</p>
        </div>

        <div className="space-y-2">
          <Label>Avatar</Label>
          <div className="grid grid-cols-5 gap-3">
            {AVATARS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAvatarId(a.id)}
                aria-label={`Avatar ${a.id}`}
                aria-pressed={avatarId === a.id}
                className={cn(
                  "flex aspect-square cursor-pointer items-center justify-center rounded-full bg-gradient-to-br text-lg font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  a.gradient,
                  avatarId === a.id ? "ring-2 ring-offset-2 ring-offset-background ring-accent" : "opacity-80 hover:opacity-100"
                )}
              >
                {a.glyph}
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" disabled={busy} variant="accent" size="lg" className="w-full">
          Continue
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
