"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const CONSENT_KEY = "mercury-cookie-consent"; // "essential" | "all"

export default function CookieConsent() {
  const [choice, setChoice] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setChoice(localStorage.getItem(CONSENT_KEY));
    setMounted(true);
  }, []);

  function choose(value: "essential" | "all") {
    localStorage.setItem(CONSENT_KEY, value);
    setChoice(value);
  }

  if (!mounted || choice) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6">
      <Card className="mx-auto flex max-w-2xl flex-col gap-4 border-border p-5 shadow-lg sm:flex-row sm:items-center">
        <Cookie className="hidden h-6 w-6 shrink-0 text-accent sm:block" aria-hidden="true" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium">We use cookies</p>
          <p className="text-sm text-muted">
            Essential cookies keep you signed in and secure. Optional cookies help us understand
            usage. Read our{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => choose("essential")}
          >
            Essential only
          </Button>
          <Button size="sm" variant="accent" className="cursor-pointer" onClick={() => choose("all")}>
            Accept all
          </Button>
        </div>
      </Card>
    </div>
  );
}
