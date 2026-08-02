"use client";

import { useEffect } from "react";

// App Router's `export const metadata` only works in server components — every page
// under (app) is "use client" (auth-gated, stateful), so titles were never set past
// the root layout's default. Every tab just said "Mercury" regardless of page.
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} — Mercury`;
  }, [title]);
}
