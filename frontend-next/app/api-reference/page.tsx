import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Logo from "@/components/Logo";
import CodeBlock from "@/components/CodeBlock";

export const metadata = { title: "API Reference" };

type Endpoint = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  summary: string;
  auth: "Bearer / API key" | "API key" | "None" | "Bearer";
  params?: { name: string; type: string; required: boolean; note?: string }[];
  curl: string;
  response: string;
};

const GROUPS: { title: string; endpoints: Endpoint[] }[] = [
  {
    title: "Transcription & Speech",
    endpoints: [
      {
        method: "POST",
        path: "/api/transcribe",
        summary: "Transcribe an audio file to text.",
        auth: "Bearer / API key",
        params: [
          { name: "file", type: "multipart file", required: true },
          { name: "reference_text", type: "string", required: false, note: "enables phoneme-error logging" },
          { name: "model_id", type: "string", required: false, note: "defaults to your tier's best model" },
        ],
        curl: `curl -X POST https://api.adapt-synthetix.app/api/transcribe \\
  -H "X-API-Key: mk_live_..." \\
  -F "file=@recording.wav"`,
        response: `{ "text": "the transcribed speech" }`,
      },
      {
        method: "POST",
        path: "/api/tts",
        summary: "Synthesize speech from text.",
        auth: "Bearer / API key",
        params: [
          { name: "text", type: "string", required: true },
          { name: "voice", type: "string", required: false },
          { name: "model_id", type: "string", required: false },
        ],
        curl: `curl -X POST https://api.adapt-synthetix.app/api/tts \\
  -H "X-API-Key: mk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"text": "hello world"}' --output speech.mp3`,
        response: `audio/mpeg binary`,
      },
      {
        method: "GET",
        path: "/api/models",
        summary: "List ASR/TTS models available to your subscription tier.",
        auth: "Bearer / API key",
        curl: `curl https://api.adapt-synthetix.app/api/models -H "X-API-Key: mk_live_..."`,
        response: `{ "tier": "pro", "asr": [{ "id": "...", "label": "..." }], "tts": [...] }`,
      },
      {
        method: "GET",
        path: "/api/errors/report",
        summary: "Phoneme-level confusion-matrix report over logged transcriptions.",
        auth: "Bearer / API key",
        curl: `curl https://api.adapt-synthetix.app/api/errors/report -H "X-API-Key: mk_live_..."`,
        response: `{ "top_errors": [...], "systematic_confusions": [...] }`,
      },
    ],
  },
  {
    title: "Bulk Ingestion",
    endpoints: [
      {
        method: "POST",
        path: "/api/ingest/upload",
        summary: "Transcribe multiple audio files from your computer in one call.",
        auth: "Bearer / API key",
        params: [{ name: "files", type: "multipart files[]", required: true, note: "max 20 per batch" }],
        curl: `curl -X POST https://api.adapt-synthetix.app/api/ingest/upload \\
  -H "X-API-Key: mk_live_..." \\
  -F "files=@a.wav" -F "files=@b.wav"`,
        response: `{ "results": [{ "filename": "a.wav", "text": "..." }] }`,
      },
      {
        method: "POST",
        path: "/api/ingest/drive",
        summary: "Import and transcribe audio files from Google Drive by file ID.",
        auth: "Bearer / API key",
        params: [
          { name: "access_token", type: "string", required: true, note: "Google OAuth token, drive.readonly scope" },
          { name: "file_ids", type: "string[]", required: true },
        ],
        curl: `curl -X POST https://api.adapt-synthetix.app/api/ingest/drive \\
  -H "X-API-Key: mk_live_..." -H "Content-Type: application/json" \\
  -d '{"access_token": "...", "file_ids": ["1a2b3c"]}'`,
        response: `{ "results": [{ "file_id": "1a2b3c", "text": "..." }] }`,
      },
    ],
  },
  {
    title: "Account",
    endpoints: [
      {
        method: "GET",
        path: "/api/profile",
        summary: "Get your profile (username, avatar, tier).",
        auth: "Bearer",
        curl: `curl https://api.adapt-synthetix.app/api/profile -H "Authorization: Bearer <token>"`,
        response: `{ "username": "dr_sharma", "tier": "pro", "avatar_id": 3 }`,
      },
      {
        method: "GET",
        path: "/api/account/usage",
        summary: "Lifetime usage — words processed, audio hours.",
        auth: "Bearer",
        curl: `curl https://api.adapt-synthetix.app/api/account/usage -H "Authorization: Bearer <token>"`,
        response: `{ "total_word_count": 12500, "audio_hours": 3.4 }`,
      },
    ],
  },
  {
    title: "API Keys",
    endpoints: [
      {
        method: "POST",
        path: "/api/keys",
        summary: "Create a new API key. The full key is only ever shown once.",
        auth: "Bearer",
        params: [{ name: "name", type: "string", required: true }],
        curl: `curl -X POST https://api.adapt-synthetix.app/api/keys \\
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \\
  -d '{"name": "production"}'`,
        response: `{ "id": 1, "key": "mk_live_...", "tier": "pro" }`,
      },
      {
        method: "GET",
        path: "/api/keys",
        summary: "List your active API keys (prefix only, not the full key).",
        auth: "Bearer",
        curl: `curl https://api.adapt-synthetix.app/api/keys -H "Authorization: Bearer <token>"`,
        response: `[{ "id": 1, "name": "production", "prefix": "mk_live_abc1" }]`,
      },
      {
        method: "DELETE",
        path: "/api/keys/{key_id}",
        summary: "Revoke an API key immediately.",
        auth: "Bearer",
        curl: `curl -X DELETE https://api.adapt-synthetix.app/api/keys/1 -H "Authorization: Bearer <token>"`,
        response: `{ "status": "revoked" }`,
      },
    ],
  },
];

const METHOD_COLOR: Record<Endpoint["method"], string> = {
  GET: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  POST: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  PATCH: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  DELETE: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

export default function ApiReferencePage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-10 flex items-center gap-3">
        <Logo className="h-8 w-8" />
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">ADAPT-Synthetix API Reference</h1>
          <p className="text-sm text-muted">
            Authenticate with a Supabase session bearer token, or an{" "}
            <code className="rounded bg-secondary px-1 py-0.5">X-API-Key</code> header from{" "}
            <Link href="/account" className="underline underline-offset-2 hover:text-foreground">
              Account → API Keys
            </Link>
            . Rate limits are per tier (Free 30/hr, Pro 300/hr, Max/Enterprise 5000/hr). Interactive
            Swagger UI is available at{" "}
            <a href="/docs" className="underline underline-offset-2 hover:text-foreground">
              /docs
            </a>
            .
          </p>
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {GROUPS.map((g) => (
          <a
            key={g.title}
            href={`#${g.title.toLowerCase().replace(/\s+/g, "-")}`}
            className="rounded-full border border-border px-3 py-1 text-sm text-muted hover:border-accent hover:text-foreground"
          >
            {g.title}
          </a>
        ))}
      </div>

      <div className="space-y-12">
        {GROUPS.map((group) => (
          <section key={group.title} id={group.title.toLowerCase().replace(/\s+/g, "-")}>
            <h2 className="mb-4 font-heading text-xl font-semibold tracking-tight">{group.title}</h2>
            <div className="space-y-4">
              {group.endpoints.map((ep) => (
                <Card key={ep.method + ep.path}>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2 font-mono text-sm font-normal">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${METHOD_COLOR[ep.method]}`}>
                        {ep.method}
                      </span>
                      <span>{ep.path}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {ep.auth}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-muted">{ep.summary}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {ep.params && (
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Parameters</p>
                        <div className="space-y-1.5">
                          {ep.params.map((p) => (
                            <div key={p.name} className="flex flex-wrap items-baseline gap-2 text-sm">
                              <code className="rounded bg-secondary px-1.5 py-0.5">{p.name}</code>
                              <span className="text-muted">{p.type}</span>
                              {p.required && (
                                <Badge variant="destructive" className="text-[10px]">
                                  required
                                </Badge>
                              )}
                              {p.note && <span className="text-xs text-muted">— {p.note}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Request</p>
                      <CodeBlock code={ep.curl} />
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Response</p>
                      <CodeBlock code={ep.response} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
