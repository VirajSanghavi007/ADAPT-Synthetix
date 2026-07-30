"use client";

import { useEffect, useState } from "react";
import { Mic, Volume2, ActivitySquare, TrendingUp } from "lucide-react";
import { API_URL } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { useModels } from "@/lib/useModels";
import Recorder from "@/components/Recorder";
import TTSPanel from "@/components/TTSPanel";
import ImportPanel from "@/components/ImportPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-1 font-heading text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted">{hint}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { session } = useSession();
  const { models } = useModels();
  const [usage, setUsage] = useState<{ transcription_count: number; synthesis_count: number } | null>(null);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch(`${API_URL}/api/account/usage`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(setUsage);
  }, [session?.access_token]);

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted">
          Welcome back{session?.user.email ? `, ${session.user.email}` : ""}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Mic} label="Transcriptions" value={usage ? String(usage.transcription_count) : "—"} hint="Total sessions logged" />
        <StatCard icon={Volume2} label="TTS generations" value={usage ? String(usage.synthesis_count) : "—"} hint="Speech synthesized" />
        <StatCard icon={ActivitySquare} label="Phoneme errors" value="—" hint="See Error Analysis" />
        <StatCard icon={TrendingUp} label="Tier" value={models?.tier ?? "—"} hint="See Subscription" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Transcribe</CardTitle>
          </CardHeader>
          <CardContent>
            <Recorder />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Text to speech</CardTitle>
          </CardHeader>
          <CardContent>
            <TTSPanel />
          </CardContent>
        </Card>
      </div>

      <ImportPanel />
    </div>
  );
}
