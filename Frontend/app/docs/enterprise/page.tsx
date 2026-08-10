import Link from "next/link";
import { Building2, KeyRound, ShieldOff, Users, Stethoscope, PlayCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Logo from "@/components/Logo";

export const metadata = { title: "Enterprise Documentation" };

export default function EnterpriseDocsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-12">
      <div className="flex items-center gap-3">
        <Logo className="h-8 w-8" />
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Enterprise documentation</h1>
          <p className="text-sm text-muted">For hospitals and organizations using ADAPT-Synthetix.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-accent" /> Getting an enterprise account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted">
            Sign up via{" "}
            <Link href="/enterprise-signup" className="underline underline-offset-2 hover:text-foreground">
              the enterprise signup page
            </Link>{" "}
            with your work email, company/organization name, your role, an employee ID, and the
            service your organization needs. Enterprise is a one-time setup, not a subscription —
            full model catalog access from the start, no Subscription tab, nothing to cancel or
            pay for.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-accent" /> Choosing a service: Non-Normative Speech or Children
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted">
          <p>
            Every enterprise account is routed to one of two domain pipelines, picked at signup:
          </p>
          <ul className="space-y-1 pl-4">
            <li><strong className="text-foreground">Non-Normative Speech</strong> — for dysarthric, atypical, and other clinically non-normative speech patterns; flags medical and emergency terminology for review.</li>
            <li><strong className="text-foreground">Children</strong> — flags distress and safety terminology for review.</li>
          </ul>
          <p>
            Each pipeline runs the same diagnostic core (confidence scoring, noise classification,
            error-type diagnosis, remediation) as the free tier, but checks flagged transcripts
            against its own domain's term list instead of the general one.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="h-4 w-4 text-accent" /> Try it first
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted">
          <p>
            The{" "}
            <Link href="/" className="underline underline-offset-2 hover:text-foreground">
              sign-in screen
            </Link>{" "}
            has a demo for each domain — sample output only, not a live transcription, so you can
            see what a pipeline flags before creating an account.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-accent" /> Logging in: employee ID, not an authenticator app
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted">
          <p>
            Individual accounts use TOTP (Google Authenticator, Authy, etc.) for two-factor
            authentication. Enterprise accounts use your <strong className="text-foreground">employee ID</strong>{" "}
            instead — you'll be asked for it every time you sign in, after your password. There's
            no authenticator app to set up, and the Settings/Account pages don't show the 2FA
            section for enterprise accounts since it doesn't apply.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldOff className="h-4 w-4 text-accent" /> What we store
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted">
          <p>
            We do not store your organization's raw audio — only transcripts, TTS input text, and
            derived phoneme-error diagnostics, same as individual accounts. Your employee ID is
            stored as a one-way hash, never in plain text.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-accent" /> Multiple staff accounts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted">
          <p>
            Each staff member currently signs up individually with the same company name and their
            own employee ID and role. A shared admin panel for managing an organization's accounts
            in one place isn't built yet.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
