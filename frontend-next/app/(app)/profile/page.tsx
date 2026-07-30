"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/useSession";
import { useProfile } from "@/lib/useProfile";
import { API_URL } from "@/lib/supabase";
import { AVATARS } from "@/lib/avatars";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const { session } = useSession();
  const { profile, loading } = useProfile();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarId, setAvatarId] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username ?? "");
      setDisplayName(profile.display_name ?? "");
      setAvatarId(profile.avatar_id);
    }
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!avatarId) {
      setStatus("Pick an avatar.");
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
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          avatar_id: avatarId,
          display_name: displayName.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "update failed");
      setStatus("Profile updated.");
    } catch (err) {
      setStatus("Error: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted">Your public identity within Mercury.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                pattern="[a-z0-9_]{3,20}"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Optional"
              />
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
                      avatarId === a.id
                        ? "ring-2 ring-offset-2 ring-offset-background ring-accent"
                        : "opacity-80 hover:opacity-100"
                    )}
                  >
                    {a.glyph}
                  </button>
                ))}
              </div>
            </div>

            {profile?.tier && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">Plan:</span>
                <Badge variant={profile.tier === "max" ? "default" : "secondary"} className="capitalize">
                  {profile.is_enterprise ? "Enterprise" : profile.tier}
                </Badge>
              </div>
            )}

            <Button type="submit" disabled={busy} variant="accent" className="cursor-pointer">
              Save changes
            </Button>

            {status && (
              <p className="text-sm text-muted" role="status" aria-live="polite">
                {status}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
