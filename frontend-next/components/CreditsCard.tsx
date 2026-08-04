"use client";

import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { API_URL } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type CreditStatus =
  | { pooled: true; tier: string; remaining: number; total: number; resets_at: string | null }
  | { pooled: false; tier?: string; asr_requests?: number; tts_requests?: number; total_requests?: number; estimated_cost_usd?: number; rate_usd_per_request?: number };

export default function CreditsCard() {
  const { session } = useSession();
  const [status, setStatus] = useState<CreditStatus | null>(null);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch(`${API_URL}/api/credits`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(setStatus);
  }, [session?.access_token]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-4 w-4" /> {status?.pooled === false ? "Usage & billing" : "Credits"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!status ? (
          <Skeleton className="h-12 w-full" />
        ) : status.pooled ? (
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-2xl font-semibold tabular-nums tracking-tight">
                {status.remaining}
              </span>
              <span className="text-sm text-muted">/ {status.total} remaining</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${Math.max(0, Math.min(100, (status.remaining / status.total) * 100))}%` }}
              />
            </div>
            {status.resets_at && (
              <p className="text-xs text-muted">
                Resets {new Date(status.resets_at).toLocaleString()}
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="font-heading text-xl font-semibold tabular-nums tracking-tight">
                {status.total_requests ?? 0}
              </p>
              <p className="text-xs text-muted">Requests this billing period</p>
            </div>
            <div>
              <p className="font-heading text-xl font-semibold tabular-nums tracking-tight">
                ${(status.estimated_cost_usd ?? 0).toFixed(2)}
              </p>
              <p className="text-xs text-muted">Estimated cost</p>
            </div>
            <div>
              <p className="font-heading text-xl font-semibold tabular-nums tracking-tight">
                ${status.rate_usd_per_request ?? 0}
              </p>
              <p className="text-xs text-muted">Per request</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
