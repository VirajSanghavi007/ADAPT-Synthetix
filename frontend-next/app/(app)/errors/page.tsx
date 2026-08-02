"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { API_URL } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { friendlyApiError } from "@/lib/apiError";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PhonemeErrorRow = {
  operation: string;
  reference_phoneme: string | null;
  hypothesis_phoneme: string | null;
  count: number;
  confusion_rate?: number;
  systematic?: boolean;
};

type ErrorReport = {
  basis: string;
  top_errors: PhonemeErrorRow[];
  systematic_confusions: PhonemeErrorRow[];
};

export default function ErrorAnalysisPage() {
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

      <Card>
        <CardHeader>
          <CardTitle>Systematic confusions</CardTitle>
          <p className="text-sm text-muted">
            Substitutions occurring ≥30% of the time for a given reference phoneme (DyPCL / POWER rule).
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <SkeletonRows />
          ) : !report || report.systematic_confusions.length === 0 ? (
            <EmptyState message="No systematic confusions yet — needs transcriptions submitted with a reference_text to populate." />
          ) : (
            <ConfusionTable rows={report.systematic_confusions} showRate />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top phoneme errors</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <SkeletonRows />
          ) : !report || report.top_errors.length === 0 ? (
            <EmptyState message="No phoneme errors logged yet." />
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Operation</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead>Hypothesis</TableHead>
          <TableHead className="text-right">Count</TableHead>
          {showRate && <TableHead className="text-right">Confusion rate</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            <TableCell>
              <Badge variant={row.operation === "substitution" ? "default" : "secondary"}>
                {row.operation}
              </Badge>
            </TableCell>
            <TableCell className="font-mono text-sm">{row.reference_phoneme || "—"}</TableCell>
            <TableCell className="font-mono text-sm">{row.hypothesis_phoneme || "—"}</TableCell>
            <TableCell className="text-right tabular-nums">{row.count}</TableCell>
            {showRate && (
              <TableCell className="text-right tabular-nums">
                {row.confusion_rate ? `${Math.round(row.confusion_rate * 100)}%` : "—"}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
