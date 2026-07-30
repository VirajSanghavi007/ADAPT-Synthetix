"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { API_URL } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Usage = {
  total_word_count: number;
  audio_hours: number;
  transcription_count: number;
  synthesis_count: number;
};

export default function UsageStatsCard() {
  const { session } = useSession();
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch(`${API_URL}/api/account/usage`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(setUsage);
  }, [session?.access_token]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Lifetime usage
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!usage ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Words processed" value={usage.total_word_count.toLocaleString()} />
            <Stat label="Audio hours" value={usage.audio_hours.toString()} />
            <Stat label="Transcriptions" value={usage.transcription_count.toString()} />
            <Stat label="Speech generations" value={usage.synthesis_count.toString()} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-heading text-xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
