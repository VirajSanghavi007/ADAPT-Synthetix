import Logo from "@/components/Logo";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-16">
      <div className="flex items-center gap-3">
        <Logo className="h-8 w-8" />
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      </div>
      <p className="text-sm text-muted">Last updated: 30 July 2026</p>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">1. Who we are</h2>
        <p className="text-foreground/90">
          Mercury ("we", "us") provides adaptive speech-to-text and text-to-speech tooling for
          lecture and medical transcription. This policy explains what personal data we collect,
          why, and the rights you have over it under India&apos;s Digital Personal Data Protection
          Act, 2023 (DPDP Act) and applicable rules.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">2. Data we collect</h2>
        <ul className="list-disc space-y-1 pl-6 text-foreground/90">
          <li>Account data: email address, phone number (optional), authentication credentials (passkey public keys, hashed passwords — never stored in plaintext).</li>
          <li>Usage data: audio you submit for transcription, text submitted for speech synthesis, and derived transcripts/diagnostics.</li>
          <li>Technical data: IP address and request metadata, retained only as needed for rate-limiting and security (audit log).</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">3. Purpose of processing (Section 4, DPDP Act)</h2>
        <p className="text-foreground/90">
          We process personal data only for the specific, lawful purpose you provided it for:
          delivering transcription/synthesis results, securing your account, improving model
          accuracy (only with data you have explicitly consented to for training), and legal
          compliance.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">4. Consent &amp; withdrawal (Section 6)</h2>
        <p className="text-foreground/90">
          Consent is collected via clear affirmative action (this notice, and the cookie banner on
          first visit). You may withdraw consent at any time from Settings → Privacy, with the same
          ease with which it was given. Withdrawal does not affect processing carried out before
          withdrawal.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">5. Your rights (Sections 11–14)</h2>
        <ul className="list-disc space-y-1 pl-6 text-foreground/90">
          <li>Right to access a summary of personal data processed and the processing activities.</li>
          <li>Right to correction and erasure of personal data.</li>
          <li>Right to grievance redressal — contact our Grievance Officer (below).</li>
          <li>Right to nominate another individual to exercise these rights on your behalf, in the event of death or incapacity.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">6. Data retention &amp; storage</h2>
        <p className="text-foreground/90">
          Data is stored on infrastructure we control (self-hosted Postgres); we do not transfer
          personal data outside India except where a data processor requires it, in which case we
          rely only on processors compliant with applicable law. Audio and transcripts are retained
          only as long as needed for the service or a shorter period you configure, then deleted.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">7. Special note: medical/health data</h2>
        <p className="text-foreground/90">
          If you use Mercury for clinical transcription involving patient data, that data is
          sensitive personal data. We do not currently offer a signed Business Associate style
          agreement or HIPAA/DPDP-grade assurance for real patient data — do not submit real
          patient-identifiable audio or text until this is explicitly confirmed as supported.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">8. Children&apos;s data</h2>
        <p className="text-foreground/90">
          We do not knowingly process personal data of individuals under 18 without verifiable
          parental consent, per Section 9 of the DPDP Act.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">9. Grievance Officer</h2>
        <p className="text-foreground/90">
          For any grievance regarding processing of your personal data, contact our Grievance
          Officer at the email address listed in your account dashboard. We aim to respond within
          the timelines prescribed under the DPDP Act and its rules.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">10. Changes to this policy</h2>
        <p className="text-foreground/90">
          We may update this policy from time to time. Material changes will be notified via email
          or an in-app notice before they take effect.
        </p>
      </section>
    </main>
  );
}
