import Link from "next/link";
import Logo from "@/components/Logo";

export const metadata = { title: "Architecture" };

const SECTIONS = [
  { id: "er", label: "ER diagram" },
  { id: "stack", label: "Tech stack" },
  { id: "system", label: "System architecture" },
  { id: "deploy", label: "Deployment" },
  { id: "journey", label: "User journey" },
];

function Panel({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-heading text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">{note}</p>
      </div>
      <div className="overflow-x-auto rounded-[14px] border border-border bg-card/40 p-4">
        {children}
      </div>
    </div>
  );
}

const MONO = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" };

function ArrowDefs({ id }: { id: string }) {
  return (
    <defs>
      <marker id={id} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="var(--primary)" />
      </marker>
    </defs>
  );
}

function Box({
  x, y, w, h, label, sub, tone = "neutral", rx = 6,
}: { x: number; y: number; w: number; h: number; label: string; sub?: string; tone?: "neutral" | "store" | "engine"; rx?: number }) {
  const fill = tone === "store" ? "color-mix(in oklch, var(--accent), transparent 88%)" : tone === "engine" ? "color-mix(in oklch, var(--primary), transparent 90%)" : "transparent";
  const stroke = tone === "store" ? "var(--accent)" : "var(--border)";
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} stroke={stroke} strokeWidth="1" />
      <text x={x + w / 2} y={y + (sub ? h / 2 - 3 : h / 2 + 4)} textAnchor="middle" fontSize="11.5" fill="var(--fg)" style={MONO}>
        {label}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 13} textAnchor="middle" fontSize="9.5" fill="var(--muted)" style={MONO}>
          {sub}
        </text>
      )}
    </g>
  );
}

function Edge({ x1, y1, x2, y2, marker, dashed }: { x1: number; y1: number; x2: number; y2: number; marker: string; dashed?: boolean }) {
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke="var(--muted)"
      strokeWidth="1.1"
      strokeDasharray={dashed ? "3 3" : undefined}
      markerEnd={`url(#${marker})`}
    />
  );
}

function EdgeLabel({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <text x={x} y={y} fontSize="9" fill="var(--muted)" textAnchor="middle" style={MONO}>
      {text}
    </text>
  );
}

export default function ArchitecturePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-14 px-6 py-12">
      <div className="flex items-center gap-3">
        <Logo className="h-8 w-8" />
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Architecture</h1>
          <p className="text-sm text-muted">
            How ADAPT-Synthetix is built, as of v5.5.0 — data model, stack, request flow, deployment, and the path a user takes through it.
          </p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-x-5 gap-y-2 border-y border-border py-3 text-sm">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="text-muted underline-offset-4 hover:text-foreground hover:underline">
            {s.label}
          </a>
        ))}
      </nav>

      {/* 1. ER diagram */}
      <section id="er" className="scroll-mt-20">
        <Panel title="ER diagram" note="Core Postgres schema (Supabase). profiles and asr_logs are the two hubs everything else hangs off — the diagnostic-core tables (bottom row) accumulate independently of any one transcription.">
          <svg viewBox="0 0 980 560" className="w-full min-w-[860px]" role="img" aria-label="Entity relationship diagram">
            <ArrowDefs id="er-arrow" />
            <Box x={400} y={20} w={180} h={54} label="profiles" sub="id · tier · is_enterprise · enterprise_domain" tone="store" rx={8} />

            <Box x={40} y={150} w={150} h={44} label="api_keys" sub="user_id · tier · key_hash" />
            <Box x={220} y={150} w={150} h={44} label="account_deletion_requests" sub="user_id · token" />
            <Box x={400} y={150} w={180} h={44} label="asr_logs" sub="id · user_id · transcript" tone="store" />
            <Box x={620} y={150} w={150} h={44} label="tts_logs" sub="user_id · input_text" />
            <Box x={810} y={150} w={140} h={44} label="model_registry" sub="kind · tier · model_id" />

            <Box x={330} y={280} w={150} h={44} label="phoneme_errors" sub="transcription_id (FK)" />
            <Box x={500} y={280} w={150} h={44} label="eval_metrics" sub="asr_log_id · wer · cer" />
            <Box x={670} y={280} w={160} h={44} label="priority_queue" sub="asr_log_id · priority_score" />

            <Box x={670} y={380} w={160} h={44} label="remedial_audio" sub="reference/hyp phoneme" />
            <Box x={500} y={380} w={150} h={44} label="phoneme_drift_events" sub="model_id · phoneme · day" />
            <Box x={330} y={380} w={150} h={44} label="drift_trigger_events" sub="model_id · reason" />

            <Box x={40} y={470} w={190} h={44} label="noise_feature_samples" sub="8-feature vector + label" />
            <Box x={250} y={470} w={190} h={44} label="error_diagnosis_samples" sub="confidence · cer · noise_cat" />
            <Box x={810} y={280} w={140} h={44} label="request_latency" sub="kind · model_id · ms" />

            <Edge x1={430} y1={74} x2={200} y2={150} marker="er-arrow" />
            <Edge x1={460} y1={74} x2={295} y2={150} marker="er-arrow" />
            <Edge x1={490} y1={74} x2={490} y2={150} marker="er-arrow" />
            <Edge x1={520} y1={74} x2={695} y2={150} marker="er-arrow" />

            <Edge x1={430} y1={194} x2={405} y2={280} marker="er-arrow" />
            <Edge x1={460} y1={194} x2={575} y2={280} marker="er-arrow" />
            <Edge x1={510} y1={194} x2={730} y2={280} marker="er-arrow" />

            <Edge x1={405} y1={324} x2={405} y2={380} marker="er-arrow" dashed />
            <Edge x1={750} y1={324} x2={750} y2={380} marker="er-arrow" />

            <EdgeLabel x={310} y={112} text="1:N" />
            <EdgeLabel x={490} y={112} text="1:N" />
            <EdgeLabel x={700} y={112} text="1:1 (live)" />
            <EdgeLabel x={400} y={252} text="1:N" />
            <EdgeLabel x={710} y={252} text="on flag" />
          </svg>
        </Panel>
      </section>

      {/* 2. Tech stack */}
      <section id="stack" className="scroll-mt-20">
        <Panel title="Tech stack" note="Free/Pro/Max share one model today (Echo 1.1); Enterprise is the only tier exercising the full catalog. Nothing below the ML row is fine-tuned yet — pretrained inference only.">
          <svg viewBox="0 0 980 420" className="w-full min-w-[860px]" role="img" aria-label="Technology stack layers">
            <ArrowDefs id="stack-arrow" />
            {[
              { y: 20, label: "Client", items: ["Next.js 16 (static export)", "Tailwind + shadcn/ui", "Supabase JS (auth)"] },
              { y: 110, label: "API", items: ["FastAPI", "SlowAPI (rate limit)", "MCP server (/mcp)"] },
              { y: 200, label: "Diagnostic core", items: ["scikit-learn (KMeans, ElasticNet)", "librosa (8-feature acoustic)", "scipy (Mann-Kendall)"] },
              { y: 290, label: "ASR / TTS engines", items: ["Whisper / Parakeet (ASR)", "Kokoro / Bark / CosyVoice2 (TTS)"] },
              { y: 380, label: "Data / infra", items: ["Supabase Postgres", "Redis", "Docker Compose"] },
            ].map((row) => (
              <g key={row.label}>
                <text x={20} y={row.y + 15} fontSize="11" fill="var(--muted)" style={MONO}>{row.label}</text>
                {row.items.map((item, i) => (
                  <Box key={item} x={190 + i * 260} y={row.y - 4} w={240} h={34} label={item} tone={row.y === 200 ? "engine" : row.y === 380 ? "store" : "neutral"} />
                ))}
              </g>
            ))}
            <line x1={310} y1={54} x2={310} y2={76} stroke="var(--muted)" strokeWidth="1.1" markerEnd="url(#stack-arrow)" />
            <line x1={310} y1={144} x2={310} y2={166} stroke="var(--muted)" strokeWidth="1.1" markerEnd="url(#stack-arrow)" />
            <line x1={310} y1={234} x2={310} y2={256} stroke="var(--muted)" strokeWidth="1.1" markerEnd="url(#stack-arrow)" />
            <line x1={310} y1={324} x2={310} y2={346} stroke="var(--muted)" strokeWidth="1.1" markerEnd="url(#stack-arrow)" />
          </svg>
        </Panel>
      </section>

      {/* 3. System architecture */}
      <section id="system" className="scroll-mt-20">
        <Panel title="Full system architecture" note="One request in: /api/transcribe. On Free and Enterprise, the diagnostic core runs inline — noise fingerprint, error-type read, priority-queue check, remediation synth — all best-effort, never blocking the transcript itself.">
          <svg viewBox="0 0 1000 520" className="w-full min-w-[900px]" role="img" aria-label="System architecture diagram">
            <ArrowDefs id="sys-arrow" />
            <Box x={30} y={30} w={170} h={50} label="Browser" sub="Next.js static export" rx={8} />
            <Box x={30} y={220} w={170} h={50} label="Supabase Auth" sub="email / Google / TOTP" />

            <Box x={280} y={130} w={200} h={54} label="FastAPI (Backend)" sub="tiers · transcribe · tts · enterprise" tone="engine" rx={8} />

            <Box x={560} y={30} w={190} h={40} label="tiers.py" sub="model catalog + rate limit" />
            <Box x={560} y={90} w={190} h={40} label="enterprise_domains.py" sub="medical / children / elderly" />
            <Box x={560} y={150} w={190} h={40} label="noise_fingerprint.py" sub="heuristic → learned (KMeans)" />
            <Box x={560} y={210} w={190} h={40} label="error_diagnosis.py" sub="heuristic → learned (ElasticNet)" />
            <Box x={560} y={270} w={190} h={40} label="priority_queue.py" sub="domain-term flagging" />
            <Box x={560} y={330} w={190} h={40} label="drift_detector.py" sub="Mann-Kendall trend test" />
            <Box x={560} y={390} w={190} h={40} label="tts_remediation.py" sub="confusion-ranked synth" />

            <Box x={280} y={430} w={200} h={50} label="Supabase Postgres" sub="profiles, logs, samples" tone="store" rx={8} />
            <Box x={30} y={340} w={170} h={50} label="Redis" sub="rate-limit counters" tone="store" />

            <Box x={800} y={70} w={170} h={50} label="space-free" sub="Echo 1.1" tone="engine" />
            <Box x={800} y={150} w={170} h={50} label="space-pro" sub="idle — same model as free" />
            <Box x={800} y={230} w={170} h={50} label="space-max" sub="idle — same model as free" />
            <Box x={800} y={310} w={170} h={50} label="Enterprise" sub="full catalog (all 3 spaces)" tone="engine" />

            <Edge x1={200} y1={55} x2={280} y2={140} marker="sys-arrow" />
            <Edge x1={115} y1={80} x2={115} y2={220} marker="sys-arrow" />
            <Edge x1={200} y1={245} x2={280} y2={175} marker="sys-arrow" />
            <Edge x1={480} y1={157} x2={560} y2={50} marker="sys-arrow" dashed />
            <Edge x1={480} y1={157} x2={560} y2={170} marker="sys-arrow" dashed />
            <Edge x1={480} y1={157} x2={560} y2={230} marker="sys-arrow" dashed />
            <Edge x1={480} y1={157} x2={560} y2={290} marker="sys-arrow" dashed />
            <Edge x1={480} y1={157} x2={560} y2={350} marker="sys-arrow" dashed />
            <Edge x1={480} y1={157} x2={560} y2={410} marker="sys-arrow" dashed />
            <Edge x1={380} y1={184} x2={380} y2={430} marker="sys-arrow" />
            <Edge x1={200} y1={365} x2={280} y2={175} marker="sys-arrow" />
            <Edge x1={750} y1={157} x2={800} y2={95} marker="sys-arrow" />
            <Edge x1={480} y1={157} x2={800} y2={175} marker="sys-arrow" />
            <Edge x1={480} y1={157} x2={800} y2={255} marker="sys-arrow" />
            <Edge x1={480} y1={184} x2={800} y2={335} marker="sys-arrow" />
          </svg>
        </Panel>
      </section>

      {/* 4. Deployment architecture */}
      <section id="deploy" className="scroll-mt-20">
        <Panel title="Full deployment architecture" note="One docker-compose.yml, five services. Dockerfile is a two-stage build (Node builds the Next.js static export, Python serves both it and the API) — build context is the repo root, not Docker/, since the Dockerfile needs Backend/ and Frontend/ from there.">
          <svg viewBox="0 0 1000 460" className="w-full min-w-[900px]" role="img" aria-label="Deployment architecture diagram">
            <ArrowDefs id="deploy-arrow" />
            <rect x={20} y={20} width={960} height={420} rx={14} fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
            <text x={40} y={45} fontSize="10.5" fill="var(--muted)" style={MONO}>docker compose (adapt-synthetix-v2)</text>

            <Box x={50} y={70} w={220} h={70} label="app" sub=":7860 · FastAPI + static" tone="engine" rx={8} />
            <Box x={50} y={180} w={220} h={54} label="redis" sub=":6379" tone="store" />
            <Box x={310} y={70} w={200} h={54} label="space-free" sub=":7861 · healthcheck" tone="engine" />
            <Box x={310} y={150} w={200} h={54} label="space-pro" sub=":7862 · healthcheck" />
            <Box x={310} y={230} w={200} h={54} label="space-max" sub=":7863 · soft dep" />

            <Box x={560} y={70} w={190} h={40} label="hf_cache_free" tone="store" />
            <Box x={560} y={150} w={190} h={40} label="hf_cache_pro" tone="store" />
            <Box x={560} y={230} w={190} h={40} label="hf_cache_max" tone="store" />
            <Box x={560} y={310} w={190} h={40} label="redisdata" tone="store" />

            <Box x={800} y={90} w={150} h={50} label="Dockerfile" sub="node → python" />
            <Box x={800} y={170} w={150} h={50} label="Frontend/out" sub="npm run build" />
            <Box x={800} y={250} w={150} h={50} label="Backend/" sub="pip install -r req." />

            <Edge x1={270} y1={105} x2={310} y2={97} marker="deploy-arrow" />
            <Edge x1={270} y1={130} x2={310} y2={177} marker="deploy-arrow" dashed />
            <Edge x1={270} y1={150} x2={310} y2={257} marker="deploy-arrow" dashed />
            <Edge x1={160} y1={140} x2={160} y2={180} marker="deploy-arrow" />
            <Edge x1={510} y1={97} x2={560} y2={90} marker="deploy-arrow" />
            <Edge x1={510} y1={177} x2={560} y2={170} marker="deploy-arrow" />
            <Edge x1={510} y1={257} x2={560} y2={250} marker="deploy-arrow" />
            <Edge x1={160} y1={207} x2={655} y2={330} marker="deploy-arrow" />
            <Edge x1={875} y1={140} x2={875} y2={170} marker="deploy-arrow" />
            <Edge x1={800} y1={195} x2={270} y2={100} marker="deploy-arrow" />
            <Edge x1={800} y1={275} x2={270} y2={110} marker="deploy-arrow" />

            <EdgeLabel x={840} y={215} text="build stage" />
            <EdgeLabel x={840} y={295} text="build stage" />
          </svg>
        </Panel>
      </section>

      {/* 5. User journey */}
      <section id="journey" className="scroll-mt-20">
        <Panel title="User stage / journey flow" note="Two entry paths converge on the same diagnostic core. Enterprise picks a domain once, at signup — everything downstream (priority terms, remediation) is scoped to it automatically.">
          <svg viewBox="0 0 1000 300" className="w-full min-w-[900px]" role="img" aria-label="User journey flow diagram">
            <ArrowDefs id="journey-arrow" />
            <Box x={20} y={110} w={140} h={54} label="Landing" sub="sign in / enterprise / demo" rx={8} />

            <Box x={210} y={30} w={150} h={44} label="Regular sign-in" sub="email or Google + TOTP" />
            <Box x={210} y={110} w={150} h={44} label="Enterprise sign-in" sub="employee ID" />
            <Box x={210} y={190} w={150} h={44} label="Demo" sub="pick a domain, no account" />

            <Box x={410} y={70} w={160} h={44} label="Dashboard" tone="engine" />
            <Box x={410} y={150} w={160} h={44} label="Domain pipeline" sub="medical / children / elderly" tone="engine" />

            <Box x={620} y={70} w={170} h={44} label="Record / transcribe" />
            <Box x={620} y={150} w={170} h={44} label="Diagnostics panel" sub="confidence, noise, error-type" />

            <Box x={840} y={30} w={140} h={44} label="Priority queue" sub="if domain-flagged" />
            <Box x={840} y={110} w={140} h={44} label="Remediation audio" sub="if systematic error" />
            <Box x={840} y={190} w={140} h={44} label="Human review" sub="importance 1–5" />

            <Edge x1={160} y1={137} x2={210} y2={52} marker="journey-arrow" />
            <Edge x1={160} y1={137} x2={210} y2={132} marker="journey-arrow" />
            <Edge x1={160} y1={137} x2={210} y2={212} marker="journey-arrow" />

            <Edge x1={360} y1={52} x2={410} y2={92} marker="journey-arrow" />
            <Edge x1={360} y1={132} x2={410} y2={172} marker="journey-arrow" />
            <Edge x1={360} y1={212} x2={410} y2={172} marker="journey-arrow" dashed />

            <Edge x1={570} y1={92} x2={620} y2={92} marker="journey-arrow" />
            <Edge x1={570} y1={172} x2={620} y2={172} marker="journey-arrow" />
            <Edge x1={705} y1={92} x2={705} y2={150} marker="journey-arrow" />

            <Edge x1={790} y1={160} x2={840} y2={52} marker="journey-arrow" dashed />
            <Edge x1={790} y1={172} x2={840} y2={132} marker="journey-arrow" dashed />
            <Edge x1={910} y1={74} x2={910} y2={110} marker="journey-arrow" />
            <Edge x1={910} y1={154} x2={910} y2={190} marker="journey-arrow" dashed />
          </svg>
        </Panel>
      </section>

      <p className="border-t border-border pt-6 text-sm text-muted">
        Back to <Link href="/docs" className="underline underline-offset-2 hover:text-foreground">Documentation</Link>.
      </p>
    </div>
  );
}
