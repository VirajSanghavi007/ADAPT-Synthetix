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

export default function AdminPage() {
  const { session, loading } = useSession();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    const headers = { Authorization: `Bearer ${session.access_token}` };
    Promise.all([
      fetch(`${API_URL}/api/admin/users`, { headers }),
      fetch(`${API_URL}/api/admin/audit-log`, { headers }),
    ])
      .then(async ([uRes, aRes]) => {
        if (!uRes.ok) throw new Error(await uRes.text());
        if (!aRes.ok) throw new Error(await aRes.text());
        setUsers(await uRes.json());
        setAudit(await aRes.json());
      })
      .catch((err) => setError(err.message));
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
    </main>
  );
}
