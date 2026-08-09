"use client";

import { useEffect } from "react";

// App Router's `export const metadata` only works in server components — every page
// under (app) is "use client" (auth-gated, stateful), so titles were never set past
// the root layout's default. Every tab just said "ADAPT-Synthetix" regardless of page.
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | ADAPT-Synthetix 2.0`;
  }, [title]);
}
