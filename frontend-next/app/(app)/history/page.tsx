"use client";

import { useEffect, useState } from "react";
import { Download, Search, Mic, Volume2 } from "lucide-react";
import { API_URL } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/lib/usePageTitle";

type HistoryItem = {
  id: number;
  text: string;
  duration_sec?: number | null;
  voice?: string;
  model_id: string | null;
  created_at: string | null;
};

const PAGE_SIZE = 20;

export default function HistoryPage() {
  usePageTitle("History");
  const { session } = useSession();
  const [kind, setKind] = useState<"asr" | "tts">("asr");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!session?.access_token) return;
    setLoading(true);
    const params = new URLSearchParams({
      kind,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (search.trim()) params.set("search", search.trim());
    fetch(`${API_URL}/api/history?${params}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => (res.ok ? res.json() : { items: [], total: 0 }))
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, kind, offset]);

  useEffect(() => {
    setOffset(0);
  }, [kind, search]);

  function downloadCsv() {
    if (!session?.access_token) return;
    fetch(`${API_URL}/api/history/export.csv?kind=${kind}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `mercury-${kind}-history.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  const hasMore = offset + PAGE_SIZE < total;
  const hasPrev = offset > 0;

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">History</h1>
          <p className="text-sm text-muted">Your past transcriptions and speech generations.</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadCsv} className="cursor-pointer gap-1.5">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={kind} onValueChange={(v) => setKind(v as "asr" | "tts")}>
          <TabsList>
            <TabsTrigger value="asr" className="cursor-pointer gap-1.5">
              <Mic className="h-3.5 w-3.5" /> Transcriptions
            </TabsTrigger>
            <TabsTrigger value="tts" className="cursor-pointer gap-1.5">
              <Volume2 className="h-3.5 w-3.5" /> Speech
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search text..."
            className="pl-8"
          />
        </div>
      </div>

      <div className="space-y-2">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted">Loading...</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Nothing here yet.</p>
        ) : (
          items.map((item) => (
            <Card key={item.id}>
              <CardContent className="space-y-2 p-4">
                <p className="selectable whitespace-pre-wrap text-sm">{item.text}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  {item.model_id && (
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {item.model_id}
                    </Badge>
                  )}
                  {item.voice && <span>voice: {item.voice}</span>}
                  {item.duration_sec != null && <span>{item.duration_sec.toFixed(1)}s</span>}
                  {item.created_at && <span>{new Date(item.created_at).toLocaleString()}</span>}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            {offset + 1}-{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPrev}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              className="cursor-pointer"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
              className="cursor-pointer"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
