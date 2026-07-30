"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { API_URL } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function DeleteAccountCard({ tier }: { tier?: string }) {
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const needsCancelFirst = tier && tier !== "free" && tier !== "enterprise";
  const email = session?.user.email ?? "";
  const emailMatches = confirmEmail.trim().toLowerCase() === email.toLowerCase() && email !== "";

  async function requestDeletion() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`${API_URL}/api/account/delete/request`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "request failed");
      setStatus(
        data.dev_confirm_link
          ? `SMTP not configured — confirm link (dev only): ${data.dev_confirm_link}`
          : "Check your email for a confirmation link. Your account will be deleted once you click it."
      );
    } catch (err) {
      setStatus("Error: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Trash2 className="h-4 w-4" /> Delete account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted">
          Permanently deletes your account and all data. This cannot be undone.
        </p>

        {needsCancelFirst ? (
          <p className="text-sm text-destructive">
            Cancel your {tier} subscription from the Subscription page first — accounts on a paid
            plan can't be deleted directly.
          </p>
        ) : (
          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) setConfirmEmail("");
            }}
          >
            <DialogTrigger render={<Button variant="destructive" className="cursor-pointer" />}>
              Delete my account
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete your account?</DialogTitle>
                <DialogDescription>
                  This will permanently erase your account, transcripts, TTS history, and API keys.
                  We'll email a confirmation link that schedules deletion 24 hours out — a last
                  window to change your mind. After that, it's irreversible.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-email">
                  Type <span className="font-medium text-foreground">{email}</span> to confirm
                </Label>
                <Input
                  id="confirm-email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} className="cursor-pointer">
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={requestDeletion}
                  disabled={busy || !emailMatches}
                  className="cursor-pointer"
                >
                  Send confirmation email
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {status && (
          <p className="break-all text-sm text-muted" role="status" aria-live="polite">
            {status}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
