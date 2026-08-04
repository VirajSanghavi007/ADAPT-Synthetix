"use client";

import AccountSection from "@/components/AccountSection";
import { usePageTitle } from "@/lib/usePageTitle";

export default function AccountPage() {
  usePageTitle("Account");

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-muted">Contact details and security — edit your username/avatar under Profile.</p>
      </div>
      <AccountSection />
    </div>
  );
}
