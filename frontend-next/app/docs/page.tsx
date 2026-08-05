import Link from "next/link";
import {
  LayoutDashboard,
  Mic,
  ActivitySquare,
  FolderUp,
  UserCircle,
  ShieldCheck,
  CreditCard,
  Code2,
  Building2,
  ArrowRight,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Logo from "@/components/Logo";
import { CURRENT_VERSION, getLatestEntry } from "@/lib/changelog";

export const metadata = { title: "Documentation — Mercury" };

const SECTIONS = [
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    body: "Your home base after signing in. Shows lifetime stats (transcriptions, TTS generations, current tier) and hosts the transcribe and speak tools.",
  },
  {
    icon: Mic,
    title: "Transcribe & speak",
    body: "Record speech to get a transcript, or type text to hear it spoken. Each tool has a model picker — which models you can choose depends on your subscription tier (Free/Pro/Max/Enterprise). Supported audio formats: WAV, MP3, MP4/AAC, FLAC, OGG, WebM, AMR, 3GPP — anything else is rejected with a clear error.",
  },
  {
    icon: FolderUp,
    title: "Bulk import",
    body: "Transcribe several files at once — upload from your computer, or import directly from Google Drive (you authorize access once per import, nothing is stored beyond the transcript).",
  },
  {
    icon: ActivitySquare,
    title: "Error Analysis",
    body: "A phoneme-level confusion matrix showing where transcription slips up most. Populated when you submit a reference_text alongside a transcription — either via the API or a future in-app reference field.",
  },
  {
    icon: UserCircle,
    title: "Profile vs. Account",
    body: "Profile is your public identity — username, avatar, display name. Account is security — email, phone, password, two-factor authentication, linked Google account, and deleting your account.",
  },
  {
    icon: CreditCard,
    title: "Subscription",
    body: "Free, Pro, and Max tiers unlock progressively better models and higher rate limits. Payment processing isn't wired up yet — the checkout flow is a preview only.",
  },
  {
    icon: ShieldCheck,
    title: "Security",
    body: "Two-factor authentication uses any standard authenticator app (Google Authenticator, Authy, etc.) via TOTP. Deleting your account requires typing your email to confirm, then clicking an emailed link — deletion executes 24 hours after that and is irreversible.",
  },
  {
    icon: Code2,
    title: "API & integrations",
    body: "Full REST API reference, including request/response examples and authentication (session token or API key).",
    href: "/api-reference",
  },
];

export default function DocsHomePage() {
  const latest = getLatestEntry();
  return (
    <div className="mx-auto max-w-4xl space-y-10 px-6 py-12">
      <div className="flex items-center gap-3">
        <Logo className="h-8 w-8" />
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Documentation</h1>
          <p className="text-sm text-muted">How Mercury works, feature by feature.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Card key={s.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <s.icon className="h-4 w-4 text-accent" />
                {s.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted">{s.body}</p>
              {s.href && (
                <Link
                  href={s.href}
                  className="mt-3 inline-flex items-center gap-1 text-sm text-accent underline-offset-2 hover:underline"
                >
                  Read more <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-accent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-accent" /> Enterprise (hospitals & organizations)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted">
            Enterprise accounts get free Max-tier access and a different login flow.
          </p>
          <Link
            href="/docs/enterprise"
            className="inline-flex items-center gap-1 text-sm text-accent underline-offset-2 hover:underline"
          >
            Enterprise docs <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            About
            <Badge variant="secondary">v{CURRENT_VERSION}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-accent" /> What's new in v{latest.version}
            </p>
            <ul className="space-y-1.5 pl-1">
              {latest.whatsNew.map((item) => (
                <li key={item} className="text-sm text-muted">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
          {latest.bugFixes.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Wrench className="h-4 w-4 text-muted-foreground" /> Bug fixes
              </p>
              <ul className="space-y-1.5 pl-1">
                {latest.bugFixes.map((item) => (
                  <li key={item} className="text-sm text-muted">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted">Released {latest.date}</p>
        </CardContent>
      </Card>
    </div>
  );
}
