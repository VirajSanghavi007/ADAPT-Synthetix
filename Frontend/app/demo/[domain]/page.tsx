import Link from "next/link";
import { notFound } from "next/navigation";
import Logo from "@/components/Logo";
import DiagnosticsPanel, { TranscribeDiagnostics } from "@/components/DiagnosticsPanel";
import { buttonVariants } from "@/components/ui/button";

const DEMO_CONTENT: Record<
  string,
  { label: string; transcript: string; diagnostics: TranscribeDiagnostics }
> = {
  non_normative: {
    label: "Non-Normative Speech",
    transcript: "My speech got harder to understand after the stroke, I need help with my medication.",
    diagnostics: {
      confidence: 0.54,
      noise_category: "indoor",
      error_type: "pronunciation-based",
      priority_queued: true,
      remediation: {
        id: null,
        carrier_text: "Every voice deserves to be heard.",
        reference_phoneme: "V",
        hypothesis_phoneme: "B",
      },
    },
  },
  children: {
    label: "Children",
    transcript: "My stomach hurts and I want to go to the nurse.",
    diagnostics: {
      confidence: 0.71,
      noise_category: "crowd",
      error_type: "pronunciation-based",
      priority_queued: true,
      remediation: {
        id: null,
        carrier_text: "Sam saw the sun set slowly.",
        reference_phoneme: "S",
        hypothesis_phoneme: "TH",
      },
    },
  },
};

export function generateStaticParams() {
  return Object.keys(DEMO_CONTENT).map((domain) => ({ domain }));
}

export default async function DemoDomainPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const content = DEMO_CONTENT[domain];
  if (!content) notFound();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="animate-fade-up card-elevated w-full max-w-md space-y-5 rounded-2xl border border-border p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo className="h-10 w-10" />
          <div>
            <h1 className="text-2xl font-semibold">{content.label} demo</h1>
            <p className="mt-1 text-sm text-muted">
              Sample output — not a live transcription, illustrates the {content.label.toLowerCase()} pipeline's diagnostic core.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card/50 p-3 text-sm">{content.transcript}</div>

        <DiagnosticsPanel diagnostics={content.diagnostics} />

        <div className="flex flex-col gap-2">
          <Link href="/enterprise-signup" className={buttonVariants({ variant: "accent", size: "lg", className: "w-full" })}>
            Create an enterprise account
          </Link>
          <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm", className: "w-full" })}>
            Back
          </Link>
        </div>
      </div>
    </main>
  );
}
