"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";

type UserRow = {
  id: string;
  display_name: string | null;
  role: string;
  created_at: string;
};

type AuditRow = {
  id: number;
  admin_id: string;
  action: string;
  target_user_id: string | null;
  created_at: string;
};

type MetricRow = { model_id: string; day: string; avg_wer: number; avg_cer: number; n: number };
type RegistryRow = {
  id: number;
  kind: string;
  tier: string;
  model_id: string;
  version_tag: string;
  is_live: boolean;
  promoted_at: string;
};
type DriftSignal = {
  since_last_training: string;
  new_asr_samples: number;
  new_tts_samples: number;
  recent_avg_wer: number | null;
  baseline_avg_wer: number | null;
  note: string;
};
type LatencyRow = {
  model_id: string;
  kind: string;
  tier: string;
  n: number;
  p50_ms: number | null;
  p95_ms: number | null;
  error_rate: number | null;
};
type SpaceStatus = {
  name: string;
  url: string | null;
  online: boolean;
  models: string[];
  error: string | null;
};

export default function AdminPage() {
  const { session, loading } = useSession();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [metrics, setMetrics] = useState<MetricRow[] | null>(null);
  const [registry, setRegistry] = useState<RegistryRow[] | null>(null);
  const [drift, setDrift] = useState<DriftSignal | null>(null);
  const [latency, setLatency] = useState<LatencyRow[] | null>(null);
  const [spaces, setSpaces] = useState<SpaceStatus[] | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  function loadAll() {
    if (!session) return;
    const headers = { Authorization: `Bearer ${session.access_token}` };
    Promise.all([
      fetch(`${API_URL}/api/admin/users`, { headers }),
      fetch(`${API_URL}/api/admin/audit-log`, { headers }),
      fetch(`${API_URL}/api/mlops/metrics`, { headers }),
      fetch(`${API_URL}/api/mlops/registry`, { headers }),
      fetch(`${API_URL}/api/mlops/drift-signal`, { headers }),
      fetch(`${API_URL}/api/mlops/latency`, { headers }),
      fetch(`${API_URL}/api/spaces/status`, { headers }),
    ])
      .then(async ([uRes, aRes, mRes, rRes, dRes, lRes, sRes]) => {
        if (!uRes.ok) throw new Error(await uRes.text());
        if (!aRes.ok) throw new Error(await aRes.text());
        setUsers(await uRes.json());
        setAudit(await aRes.json());
        if (mRes.ok) setMetrics(await mRes.json());
        if (rRes.ok) setRegistry(await rRes.json());
        if (dRes.ok) setDrift(await dRes.json());
        if (lRes.ok) setLatency(await lRes.json());
        if (sRes.ok) setSpaces(await sRes.json());
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 15000); // refresh space status every 15s
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (loading) return null;

  if (!session) {
    return (
      <main className="mx-auto max-w-md space-y-4 p-8 text-center">
        <p>Sign in required.</p>
        <Link href="/login" className="text-accent underline hover:opacity-90">
          Sign in
        </Link>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-md space-y-4 p-8 text-center">
        <p className="text-destructive">{error}</p>
        <Link href="/" className="text-accent underline hover:opacity-90">
          Back to app
        </Link>
      </main>
    );
  }

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-8">
      <h1 className="text-2xl font-semibold">Admin</h1>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Model Spaces</h2>
          <button
            onClick={loadAll}
            className="cursor-pointer text-sm text-accent underline hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {spaces?.map((s) => (
            <div key={s.name} className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium capitalize">{s.name}</span>
                <span
                  className={`flex items-center gap-1.5 text-sm ${s.online ? "text-accent" : "text-destructive"}`}
                >
                  <span className={`h-2 w-2 rounded-full ${s.online ? "bg-accent" : "bg-destructive"}`} />
                  {s.online ? "Online" : "Offline"}
                </span>
              </div>
              {s.online ? (
                <p className="mt-1 text-xs text-muted">{s.models.join(", ")}</p>
              ) : (
                <p className="mt-1 text-xs text-destructive">{s.error}</p>
              )}
            </div>
          ))}
          {!spaces && <p className="text-sm text-muted">Loading...</p>}
        </div>
        <p className="text-xs text-muted">Auto-refreshes every 15s.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Users</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">Display name</th>
                <th className="p-3">Role</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="p-3 font-mono text-xs">
                    {revealed.has(u.id) ? u.id : u.id.slice(0, 8) + "…"}
                    <button
                      onClick={() => toggleReveal(u.id)}
                      className="ml-2 cursor-pointer text-accent underline hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {revealed.has(u.id) ? "hide" : "reveal"}
                    </button>
                  </td>
                  <td className="p-3">{u.display_name || "—"}</td>
                  <td className="p-3">{u.role}</td>
                  <td className="p-3">{new Date(u.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Admin audit log</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3">Admin</th>
                <th className="p-3">Action</th>
                <th className="p-3">Target</th>
                <th className="p-3">When</th>
              </tr>
            </thead>
            <tbody>
              {audit?.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="p-3 font-mono text-xs">{a.admin_id.slice(0, 8)}…</td>
                  <td className="p-3">{a.action}</td>
                  <td className="p-3 font-mono text-xs">
                    {a.target_user_id ? a.target_user_id.slice(0, 8) + "…" : "—"}
                  </td>
                  <td className="p-3">{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">MLOps — drift signal</h2>
        {drift ? (
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-border p-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-muted">New ASR samples</p>
              <p className="text-lg font-semibold">{drift.new_asr_samples}</p>
            </div>
            <div>
              <p className="text-muted">New TTS samples</p>
              <p className="text-lg font-semibold">{drift.new_tts_samples}</p>
            </div>
            <div>
              <p className="text-muted">Recent avg WER</p>
              <p className="text-lg font-semibold">{drift.recent_avg_wer ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted">Baseline avg WER</p>
              <p className="text-lg font-semibold">{drift.baseline_avg_wer ?? "—"}</p>
            </div>
            <p className="col-span-2 text-xs text-muted sm:col-span-4">{drift.note}</p>
          </div>
        ) : (
          <p className="text-sm text-muted">No drift signal available.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">MLOps — latency (p50/p95, last 7 days)</h2>
        {latency && latency.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left">
                <tr>
                  <th className="p-3">Model</th>
                  <th className="p-3">Kind</th>
                  <th className="p-3">Tier</th>
                  <th className="p-3">p50 (ms)</th>
                  <th className="p-3">p95 (ms)</th>
                  <th className="p-3">Error rate</th>
                  <th className="p-3">Requests</th>
                </tr>
              </thead>
              <tbody>
                {latency.map((l, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-3 font-mono text-xs">{l.model_id}</td>
                    <td className="p-3">{l.kind}</td>
                    <td className="p-3">{l.tier}</td>
                    <td className="p-3">{l.p50_ms ?? "—"}</td>
                    <td className="p-3">{l.p95_ms ?? "—"}</td>
                    <td className="p-3">{l.error_rate !== null ? `${(l.error_rate * 100).toFixed(1)}%` : "—"}</td>
                    <td className="p-3">{l.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">No requests logged in the last 7 days.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">MLOps — model registry</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3">Kind</th>
                <th className="p-3">Tier</th>
                <th className="p-3">Model</th>
                <th className="p-3">Version</th>
                <th className="p-3">Live</th>
                <th className="p-3">Promoted</th>
              </tr>
            </thead>
            <tbody>
              {registry?.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3">{r.kind}</td>
                  <td className="p-3">{r.tier}</td>
                  <td className="p-3 font-mono text-xs">{r.model_id}</td>
                  <td className="p-3">{r.version_tag}</td>
                  <td className="p-3">{r.is_live ? "✓" : "—"}</td>
                  <td className="p-3">{new Date(r.promoted_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">MLOps — WER/CER trend</h2>
        {metrics && metrics.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left">
                <tr>
                  <th className="p-3">Model</th>
                  <th className="p-3">Day</th>
                  <th className="p-3">Avg WER</th>
                  <th className="p-3">Avg CER</th>
                  <th className="p-3">Samples</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-3 font-mono text-xs">{m.model_id}</td>
                    <td className="p-3">{new Date(m.day).toLocaleDateString()}</td>
                    <td className="p-3">{m.avg_wer}</td>
                    <td className="p-3">{m.avg_cer}</td>
                    <td className="p-3">{m.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">
            No eval data yet — populated when /api/transcribe is called with a reference_text.
          </p>
        )}
      </section>
    </main>
  );
}
