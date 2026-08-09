import Logo from "@/components/Logo";

const STEPS = [
  "Connecting to backend",
  "Loading ASR model",
  "Loading TTS model",
  "Initializing phoneme engine",
  "Building session",
];

export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="animate-fade-up flex flex-col items-center gap-4">
        <Logo className="h-12 w-12 animate-pulse" />
        <h1 className="font-heading text-2xl font-semibold tracking-tight">ADAPT-Synthetix</h1>
      </div>

      <ol className="w-full max-w-xs space-y-2 text-left" aria-label="Loading steps">
        {STEPS.map((step, i) => (
          <li key={step} className="flex items-center gap-3 text-sm text-muted">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-xs">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <div
        className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-label="Loading progress"
      >
        <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        Loading ADAPT-Synthetix…
      </span>
    </main>
  );
}
