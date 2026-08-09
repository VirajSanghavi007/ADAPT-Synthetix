"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
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
import { tierDisplayName } from "@/lib/tierNames";

const MAX_PHOTO_BYTES = 250_000; 

export default function ProfileSection() {
  const { session } = useSession();
  const { profile, loading } = useProfile();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarId, setAvatarId] = useState<number | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username ?? "");
      setDisplayName(profile.display_name ?? "");
      setAvatarId(profile.avatar_id);
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setStatus("Photo must be PNG, JPEG, or WebP.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setStatus(`Photo too large — max ${Math.round(MAX_PHOTO_BYTES / 1000)}KB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(reader.result as string);
      setStatus(null);
    };
    reader.readAsDataURL(file);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!avatarId && !avatarUrl) {
      setStatus("Pick an avatar or upload a photo.");
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
          avatar_id: avatarUrl ? null : avatarId,
          avatar_url: avatarUrl,
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
            <Label>Profile picture</Label>
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <div className="relative">
                  <img
                    src={avatarUrl}
                    alt="Your uploaded profile picture"
                    className="h-14 w-14 rounded-full object-cover ring-2 ring-offset-2 ring-offset-background ring-accent"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarUrl(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    aria-label="Remove uploaded photo"
                    className="absolute -right-1 -top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-destructive text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" /> Upload photo
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={onPhotoSelected}
              />
            </div>
            <p className="text-xs text-muted">Or pick a preset avatar below.</p>
            <div className="grid grid-cols-5 gap-3">
              {AVATARS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setAvatarId(a.id);
                    setAvatarUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  aria-label={`Avatar ${a.id}`}
                  aria-pressed={!avatarUrl && avatarId === a.id}
                  className={cn(
                    "flex aspect-square cursor-pointer items-center justify-center rounded-full bg-gradient-to-br text-lg font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    a.gradient,
                    !avatarUrl && avatarId === a.id
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
              <Badge variant={profile.tier === "max" ? "default" : "secondary"}>
                {profile.is_enterprise ? "Enterprise" : tierDisplayName(profile.tier)}
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
  );
}
