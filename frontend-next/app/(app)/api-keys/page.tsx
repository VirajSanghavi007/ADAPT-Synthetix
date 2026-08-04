"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Trash2, Copy, Check, ExternalLink } from "lucide-react";
import { API_URL } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { usePageTitle } from "@/lib/usePageTitle";
import { tierDisplayName } from "@/lib/tierNames";

type ApiKeyRow = {
  id: number;
  name: string;
  prefix: string;
  tier: string;
  created_at: string | null;
  last_used_at: string | null;
};

export default function ApiKeysPage() {
  usePageTitle("API Keys");
  const { session } = useSession();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/keys`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) setKeys(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session?.access_token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "failed to create key");
      setNewKey(data.key);
      setNewName("");
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revokeKey(id: number) {
    await fetch(`${API_URL}/api/keys/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    load();
  }

  async function copyKey() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">API Keys</h1>
          <p className="text-sm text-muted">
            For third-party or agent access to Mercury's API.{" "}
            <Link href="/api-reference" className="inline-flex items-center gap-1 text-accent underline-offset-2 hover:underline">
              View API reference <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(next) => {
            setCreateOpen(next);
            if (!next) {
              setNewKey(null);
              setError(null);
            }
          }}
        >
          <DialogTrigger render={<Button variant="accent" className="cursor-pointer gap-1.5" />}>
            <KeyRound className="h-4 w-4" /> New key
          </DialogTrigger>
          <DialogContent>
            {newKey ? (
              <>
                <DialogHeader>
                  <DialogTitle>Copy your key now</DialogTitle>
                  <DialogDescription>
                    This is the only time the full key is shown. If you lose it, revoke it and
                    create a new one.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary p-3 font-mono text-sm">
                  <span className="flex-1 truncate">{newKey}</span>
                  <Button variant="ghost" size="icon-sm" onClick={copyKey} className="cursor-pointer">
                    {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)} className="cursor-pointer">
                    Done
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Create a new API key</DialogTitle>
                  <DialogDescription>Give it a name so you can tell keys apart later.</DialogDescription>
                </DialogHeader>
                <form onSubmit={createKey} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="key-name">Name</Label>
                    <Input
                      id="key-name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. production"
                      autoFocus
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <DialogFooter>
                    <Button type="submit" variant="accent" disabled={busy} className="cursor-pointer">
                      Create
                    </Button>
                  </DialogFooter>
                </form>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your keys</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : keys.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No API keys yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell className="font-mono text-sm text-muted">{k.prefix}...</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{tierDisplayName(k.tier)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => revokeKey(k.id)}
                        aria-label={`Revoke ${k.name}`}
                        className="cursor-pointer text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
