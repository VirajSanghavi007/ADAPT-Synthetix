"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Lightbulb, RefreshCw } from "lucide-react";
import { API_URL } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { friendlyApiError } from "@/lib/apiError";
import { usePageTitle } from "@/lib/usePageTitle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type PhonemeErrorRow = {
  operation: string;
  reference_phoneme: string | null;
  hypothesis_phoneme: string | null;
  count: number;
  confusion_rate?: number;
  systematic?: boolean;
  plain_english: string;
};

type ErrorReport = {
  basis: string;
  summary: string | null;
  top_errors: PhonemeErrorRow[];
  systematic_confusions: PhonemeErrorRow[];
};

export default function ErrorAnalysisPage() {
  usePageTitle("Error Analysis");
  const { session } = useSession();
  const [report, setReport] = useState<ErrorReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/errors/report`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error(await friendlyApiError(res));
      setReport(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session?.access_token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Error Analysis</h1>
          <p className="text-sm text-muted">
            Phoneme-level confusion matrix, aligned against reference transcripts.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
          className="cursor-pointer gap-2"
        >
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Could not load error report: {error}
          </CardContent>
        </Card>
      )}

      {report?.summary && (
        <Card className="border-accent/40 bg-accent/5">
          <CardContent className="flex items-start gap-2 p-4 text-sm">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <p>{report.summary}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recurring mix-ups</CardTitle>
          <p className="text-sm text-muted">
            Sounds that get confused for another sound often enough to be a pattern, not a fluke — worth
            practicing if you're using this for speech training.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <SkeletonRows />
          ) : !report || report.systematic_confusions.length === 0 ? (
            <EmptyState message="No recurring mix-ups yet — needs transcriptions submitted with a reference_text to populate, and a large enough sample for a pattern to show." />
          ) : (
            <ConfusionTable rows={report.systematic_confusions} showRate />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All recent mistakes</CardTitle>
          <p className="text-sm text-muted">Every kind of sound mix-up seen, most common first.</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <SkeletonRows />
          ) : !report || report.top_errors.length === 0 ? (
            <EmptyState message="No errors logged yet." />
          ) : (
            <ConfusionTable rows={report.top_errors} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConfusionTable({ rows, showRate = false }: { rows: PhonemeErrorRow[]; showRate?: boolean }) {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
        >
          <div className="flex items-center gap-3">
            <Badge variant={row.operation === "substitution" ? "default" : "secondary"} className="capitalize">
              {row.operation}
            </Badge>
            <p className="text-sm">{row.plain_english}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-right">
            {showRate && row.confusion_rate !== undefined && (
              <span className="text-xs text-muted tabular-nums">
                {Math.round(row.confusion_rate * 100)}% of the time
              </span>
            )}
            <span className="text-sm font-medium tabular-nums">{row.count}×</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm text-muted">{message}</p>;
}
